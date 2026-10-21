import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { code?: string; machineId?: string; appVersion?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const { code, machineId, appVersion } = body;
  if (!code || !machineId || String(machineId).length > 200) return json({ error: "bad_request" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const activationToken = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

  const { data, error } = await supabase.rpc("redeem_code", {
    p_code: code,
    p_machine_id: machineId,
    p_app_version: appVersion ?? null,
    p_token_hash: await sha256Hex(activationToken),
  });
  if (error) return json({ error: "invalid_code" }, 400);

  const payload = {
    v: 1,
    aid: data.activation_id,
    kind: data.kind,
    cid: data.customer_id,
    machine: machineId,
    iat: Math.floor(Date.now() / 1000),
  };
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    fromBase64(Deno.env.get("LICENSE_PRIVATE_KEY")!),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, payloadBytes));

  return json({
    license: `${toBase64Url(payloadBytes)}.${toBase64Url(signature)}`,
    activationToken,
    activationId: data.activation_id,
    kind: data.kind,
    vendor: data.vendor,
  });
});
