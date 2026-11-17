-- Aplicar en grisalis-web (fteuajrvyjjdjbphlulp) antes de actualizar redeem.
-- Conserva registros, identificadores y licencias server/station existentes.
begin;
alter table public.activation_codes drop constraint if exists activation_codes_kind_check;
alter table public.activation_codes add constraint activation_codes_kind_check
  check (kind in ('standalone', 'server', 'station'));
alter table public.activations drop constraint if exists activations_kind_check;
alter table public.activations add constraint activations_kind_check
  check (kind in ('standalone', 'server', 'station'));

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
  if p_qty is null or p_qty < 1 or p_qty > 100 then raise exception 'Cantidad inválida'; end if;
  if p_kind not in ('standalone', 'server', 'station') then raise exception 'kind inválido'; end if;
  if p_kind = 'station' and p_customer is null then raise exception 'Un código de estación requiere customer_id'; end if;
  if p_kind = 'station' and not exists (select 1 from activations where customer_id = p_customer and kind = 'server' and status = 'active') then
    raise exception 'Una estación requiere un cliente con servidor LAN activo';
  end if;
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
  where id = p_activation_id and token_hash = p_token_hash and status = 'active' and kind in ('standalone', 'server');
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

-- El bloqueo y la comprobación ocurren en la misma transacción que el canje.
-- La RPC anterior se conserva para compatibilidad con despliegues existentes.
create or replace function public.redeem_code_for_installation(
  p_code text, p_machine_id text, p_app_version text, p_token_hash text,
  p_expected_kind text default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  normalized text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  code_kind text;
begin
  if p_expected_kind is not null and p_expected_kind not in ('standalone', 'server', 'station') then
    raise exception 'invalid_kind';
  end if;
  if left(normalized, 3) = 'GFX' then normalized := substr(normalized, 4); end if;
  select kind into code_kind from public.activation_codes
  where code_hash = encode(digest(normalized, 'sha256'), 'hex') and status = 'available'
  for update;
  if code_kind is null then raise exception 'invalid_code'; end if;
  if p_expected_kind is not null and code_kind <> p_expected_kind then
    raise exception 'wrong_license_kind';
  end if;
  return public.redeem_code(p_code, p_machine_id, p_app_version, p_token_hash);
end;
$$;
revoke all on function public.redeem_code_for_installation(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.redeem_code_for_installation(text, text, text, text, text) to service_role;

grant execute on function public.create_activation_codes(uuid, text, int, uuid) to service_role;
grant execute on function public.register_customer(uuid, text, jsonb) to service_role;
commit;
