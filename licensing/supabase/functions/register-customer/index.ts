import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const FIELDS = ["business_name", "nit", "city", "phone", "email", "business_type"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { activationId?: string; activationToken?: string; customer?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const { activationId, activationToken, customer } = body;
  if (!activationId || !activationToken || !customer) return json({ error: "bad_request" }, 400);

  const data: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = customer[field];
    if (typeof value === "string" && value.trim()) data[field] = value.trim().slice(0, 200);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: customerId, error } = await supabase.rpc("register_customer", {
    p_activation_id: activationId,
    p_token_hash: await sha256Hex(activationToken),
    p_data: data,
  });
  if (error) return json({ error: "invalid_activation" }, 400);

  return json({ ok: true, customerId });
});
