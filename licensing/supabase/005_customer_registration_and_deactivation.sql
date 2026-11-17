-- Vincula cliente/código y permite desactivar instalaciones sin borrar su historial.
begin;
create or replace function public.register_customer(
  p_activation_id uuid, p_token_hash text, p_data jsonb
) returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare a activations; cust_id uuid;
begin
  perform 1 from activation_codes where id = (select code_id from activations where id = p_activation_id) for update;
  select * into a from activations
  where id = p_activation_id and token_hash = p_token_hash
    and status = 'active' and kind in ('standalone', 'server') for update;
  if a.id is null then raise exception 'invalid_activation'; end if;
  if a.customer_id is null then
    if nullif(trim(p_data->>'business_name'), '') is null then
      raise exception 'missing_customer_data';
    end if;
    insert into customers (vendor_id, business_name, nit, city, phone, email, business_type, registered_at)
    values (a.vendor_id, p_data->>'business_name', p_data->>'nit', p_data->>'city',
      p_data->>'phone', p_data->>'email', p_data->>'business_type', now())
    returning id into cust_id;
    update activations set customer_id = cust_id where id = a.id;
  else
    cust_id := a.customer_id;
    update customers set
      business_name = coalesce(nullif(trim(p_data->>'business_name'), ''), business_name),
      nit = coalesce(p_data->>'nit', nit), city = coalesce(p_data->>'city', city),
      phone = coalesce(p_data->>'phone', phone), email = coalesce(p_data->>'email', email),
      business_type = coalesce(p_data->>'business_type', business_type),
      registered_at = coalesce(registered_at, now()) where id = cust_id;
  end if;
  update activation_codes set customer_id = cust_id where id = a.code_id;
  return cust_id;
end;
$$;
-- Repara los códigos cuyo cliente ya estaba registrado en la instalación.
update public.activation_codes c set customer_id = a.customer_id
from public.activations a
where a.code_id = c.id and c.customer_id is null and a.customer_id is not null;

create or replace function public.deactivate_license(p_code uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Mismo orden de bloqueo que redeem: código antes de instalación.
  perform 1 from activation_codes where id = p_code for update;
  if not found then raise exception 'code_not_found'; end if;
  update activation_codes set status = 'revoked' where id = p_code;
  update activations set status = 'released', released_at = coalesce(released_at, now())
    where code_id = p_code and status = 'active';
end;
$$;
revoke all on function public.register_customer(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.register_customer(uuid, text, jsonb) to service_role;
revoke all on function public.deactivate_license(uuid) from public, anon, authenticated;
grant execute on function public.deactivate_license(uuid) to service_role;
commit;
