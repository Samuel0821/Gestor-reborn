-- GestorFX: licencias y control de instalaciones por vendedor.
-- Ejecutar completo en Supabase > SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  business_name text,
  nit text,
  city text,
  phone text,
  email text,
  business_type text,
  created_at timestamptz not null default now(),
  registered_at timestamptz
);

create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  kind text not null check (kind in ('server', 'station')),
  vendor_id uuid not null references public.vendors(id),
  -- Obligatorio en estaciones; opcional en servidor (reinstalación de un cliente existente).
  customer_id uuid references public.customers(id),
  status text not null default 'available' check (status in ('available', 'used', 'revoked')),
  note text,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  check (kind <> 'station' or customer_id is not null)
);

create table if not exists public.activations (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null unique references public.activation_codes(id),
  vendor_id uuid not null references public.vendors(id),
  customer_id uuid references public.customers(id),
  kind text not null check (kind in ('server', 'station')),
  machine_id text not null,
  app_version text,
  token_hash text not null,
  status text not null default 'active' check (status in ('active', 'released')),
  created_at timestamptz not null default now(),
  released_at timestamptz
);

-- Sin políticas: solo se accede desde las Edge Functions (service_role) o el SQL Editor.
alter table public.vendors enable row level security;
alter table public.customers enable row level security;
alter table public.activation_codes enable row level security;
alter table public.activations enable row level security;
revoke all on public.vendors, public.customers, public.activation_codes, public.activations from anon, authenticated;

-- Vista para tu panel: quién instaló, a quién y cuándo.
create or replace view public.installation_report as
select
  a.created_at as installed_at,
  v.full_name as vendor,
  a.kind,
  c.business_name,
  c.nit,
  c.city,
  c.phone,
  c.email,
  a.machine_id,
  a.app_version,
  a.status
from public.activations a
join public.vendors v on v.id = a.vendor_id
left join public.customers c on c.id = a.customer_id
order by a.created_at desc;
revoke all on public.installation_report from anon, authenticated;

-- Genera códigos de un solo uso. Se muestran en texto plano SOLO aquí; en la tabla queda el hash.
create or replace function public.create_activation_codes(
  p_vendor uuid,
  p_kind text,
  p_qty int default 1,
  p_customer uuid default null
) returns table(code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw text;
  bytes bytea;
  i int;
  n int;
begin
  if p_kind not in ('server', 'station') then raise exception 'kind inválido'; end if;
  if p_kind = 'station' and p_customer is null then raise exception 'Un código de estación requiere customer_id'; end if;
  if not exists (select 1 from vendors where id = p_vendor and active) then raise exception 'Vendedor inexistente o inactivo'; end if;

  for n in 1..p_qty loop
    bytes := gen_random_bytes(16);
    raw := '';
    for i in 0..15 loop
      raw := raw || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;
    insert into activation_codes (code_hash, kind, vendor_id, customer_id)
    values (encode(digest(raw, 'sha256'), 'hex'), p_kind, p_vendor, p_customer);
    code := 'GFX-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4) || '-' || substr(raw, 13, 4);
    return next;
  end loop;
end;
$$;

-- Canje atómico: un código solo puede usarse una vez.
create or replace function public.redeem_code(
  p_code text,
  p_machine_id text,
  p_app_version text,
  p_token_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  c activation_codes;
  act_id uuid;
  vendor_name text;
begin
  if left(normalized, 3) = 'GFX' then normalized := substr(normalized, 4); end if;
  if length(normalized) <> 16 or coalesce(p_machine_id, '') = '' then
    raise exception 'invalid_code';
  end if;

  update activation_codes ac
  set status = 'used', used_at = now()
  where ac.code_hash = encode(digest(normalized, 'sha256'), 'hex')
    and ac.status = 'available'
    and exists (select 1 from vendors v where v.id = ac.vendor_id and v.active)
  returning * into c;

  if c.id is null then raise exception 'invalid_code'; end if;

  insert into activations (code_id, vendor_id, customer_id, kind, machine_id, app_version, token_hash)
  values (c.id, c.vendor_id, c.customer_id, c.kind, p_machine_id, p_app_version, p_token_hash)
  returning id into act_id;

  select full_name into vendor_name from vendors where id = c.vendor_id;

  return jsonb_build_object(
    'activation_id', act_id,
    'kind', c.kind,
    'customer_id', c.customer_id,
    'vendor', vendor_name
  );
end;
$$;

-- Registra los datos del cliente al terminar el asistente de configuración.
create or replace function public.register_customer(
  p_activation_id uuid,
  p_token_hash text,
  p_data jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  a activations;
  cust_id uuid;
begin
  select * into a from activations
  where id = p_activation_id and token_hash = p_token_hash and status = 'active' and kind = 'server';
  if a.id is null then raise exception 'invalid_activation'; end if;

  if a.customer_id is null then
    insert into customers (vendor_id, business_name, nit, city, phone, email, business_type, registered_at)
    values (a.vendor_id, p_data->>'business_name', p_data->>'nit', p_data->>'city', p_data->>'phone',
            p_data->>'email', p_data->>'business_type', now())
    returning id into cust_id;
    update activations set customer_id = cust_id where id = a.id;
  else
    cust_id := a.customer_id;
    update customers set
      business_name = coalesce(p_data->>'business_name', business_name),
      nit = coalesce(p_data->>'nit', nit),
      city = coalesce(p_data->>'city', city),
      phone = coalesce(p_data->>'phone', phone),
      email = coalesce(p_data->>'email', email),
      business_type = coalesce(p_data->>'business_type', business_type),
      registered_at = coalesce(registered_at, now())
    where id = cust_id;
  end if;
  return cust_id;
end;
$$;

-- Libera una activación (equipo dañado). Después genera un código nuevo con create_activation_codes.
create or replace function public.release_activation(p_activation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update activations set status = 'released', released_at = now() where id = p_activation;
$$;

revoke all on function public.create_activation_codes(uuid, text, int, uuid) from public, anon, authenticated;
revoke all on function public.redeem_code(text, text, text, text) from public, anon, authenticated;
revoke all on function public.register_customer(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.release_activation(uuid) from public, anon, authenticated;
grant execute on function public.redeem_code(text, text, text, text) to service_role;
grant execute on function public.register_customer(uuid, text, jsonb) to service_role;
