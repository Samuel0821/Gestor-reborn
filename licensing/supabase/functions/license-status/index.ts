import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (!body || typeof body.activationId !== "string" || typeof body.activationToken !== "string"
    || typeof body.machineId !== "string" || body.activationToken.length > 200 || body.machineId.length > 200
    || !/^[0-9a-f-]{36}$/i.test(body.activationId)) return json({ error: "bad_request" }, 400);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.activationToken));
  const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db.from("activations").select("status,code_id,customer_id")
    .eq("id", body.activationId).eq("token_hash", hash).eq("machine_id", body.machineId).maybeSingle();
  if (error) return json({ error: "status_unavailable" }, 503);
  // No invalida una licencia ante errores de autenticación o una respuesta incompleta.
  if (!data) return json({ error: "invalid_activation" }, 403);
  const code = await db.from("activation_codes").select("status").eq("id", data.code_id).single();
  if (code.error) return json({ error: "status_unavailable" }, 503);
  return json({ status: data.status === "active" && code.data.status !== "revoked" ? "active" : "released", customerId: data.customer_id });
});
