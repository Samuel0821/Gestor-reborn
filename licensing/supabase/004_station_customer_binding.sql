-- Aplicar en grisalis-web antes de actualizar la función redeem.
-- El cliente del servidor se comprueba antes de consumir un código de estación.
begin;
create or replace function public.redeem_code_for_station(
  p_code text, p_machine_id text, p_app_version text, p_token_hash text,
  p_expected_customer uuid
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  normalized text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  code_customer uuid;
  code_kind text;
begin
  if p_expected_customer is null then raise exception 'wrong_license_customer'; end if;
  if left(normalized, 3) = 'GFX' then normalized := substr(normalized, 4); end if;
  select customer_id, kind into code_customer, code_kind from public.activation_codes
  where code_hash = encode(digest(normalized, 'sha256'), 'hex') and status = 'available'
  for update;
  if code_kind is null then raise exception 'invalid_code'; end if;
  if code_kind <> 'station' then raise exception 'wrong_license_kind'; end if;
  if code_customer is distinct from p_expected_customer then raise exception 'wrong_license_customer'; end if;
  if not exists (select 1 from public.activations where customer_id = p_expected_customer and kind = 'server' and status = 'active') then
    raise exception 'invalid_activation';
  end if;
  return public.redeem_code_for_installation(p_code, p_machine_id, p_app_version, p_token_hash, 'station');
end;
$$;
revoke all on function public.redeem_code_for_station(text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_code_for_station(text, text, text, text, uuid) to service_role;
commit;
