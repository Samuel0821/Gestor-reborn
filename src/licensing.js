const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SUPABASE_URL = "https://uesoiiawrkziijrdowkx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_uxpVfwqLMZx3D_qfFQoHvA_IIYU07iD";
const LICENSE_PUBLIC_KEY = "MCowBQYDK2VwAyEAWRrzADQMdFd0TctLpLFFExc1iDuav7DO6S0d0Lexthg=";
const REQUEST_TIMEOUT_MS = 20000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;

let failedAttempts = 0;
let lockedUntil = 0;

function licenseFilePath(baseDirectory) {
  return path.join(baseDirectory, "license.json");
}

function getMachineId() {
  let raw = "";
  try {
    const output = execFileSync("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"], { encoding: "utf8", windowsHide: true });
    raw = (output.match(/MachineGuid\s+REG_SZ\s+(\S+)/i) || [])[1] || "";
  } catch (_) {}
  if (!raw) raw = `${os.hostname()}|${os.platform()}|${os.arch()}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function fromBase64Url(value) {
  return Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function verifyLicense(license, machineId) {
  try {
    const [payloadPart, signaturePart] = String(license || "").split(".");
    if (!payloadPart || !signaturePart) return null;
    const payloadBytes = fromBase64Url(payloadPart);
    const publicKey = crypto.createPublicKey({ key: Buffer.from(LICENSE_PUBLIC_KEY, "base64"), format: "der", type: "spki" });
    if (!crypto.verify(null, payloadBytes, publicKey, fromBase64Url(signaturePart))) return null;
    const payload = JSON.parse(payloadBytes.toString("utf8"));
    if (payload.v !== 1 || payload.machine !== machineId) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function readStored(baseDirectory) {
  try {
    return JSON.parse(fs.readFileSync(licenseFilePath(baseDirectory), "utf8"));
  } catch (_) {
    return null;
  }
}

function writeStored(baseDirectory, data) {
  fs.mkdirSync(baseDirectory, { recursive: true });
  fs.writeFileSync(licenseFilePath(baseDirectory), JSON.stringify(data, null, 2), "utf8");
}

function getLicenseState(baseDirectory) {
  const stored = readStored(baseDirectory);
  const payload = stored && verifyLicense(stored.license, getMachineId());
  return { valid: Boolean(payload && payload.kind === "server"), stored, payload };
}

async function callFunction(name, body) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  return { ok: response.ok, status: response.status, data };
}

async function activate(baseDirectory, code, appVersion) {
  if (getLicenseState(baseDirectory).valid) return { success: true, message: "Esta instalación ya está activada." };
  if (Date.now() < lockedUntil) {
    return { success: false, message: "Demasiados intentos. Espere un minuto e intente de nuevo." };
  }
  if (!/^[A-Za-z0-9-\s]{10,40}$/.test(String(code || ""))) {
    return { success: false, message: "Ingrese un código de activación válido." };
  }

  const machineId = getMachineId();
  let result;
  try {
    result = await callFunction("redeem", { code, machineId, appVersion });
  } catch (_) {
    return { success: false, message: "No se pudo conectar con el servicio de activación. Verifique la conexión a Internet del servidor." };
  }

  if (!result.ok) {
    if (result.status >= 500) return { success: false, message: "El servicio de activación no está disponible. Intente más tarde." };
    failedAttempts += 1;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) { failedAttempts = 0; lockedUntil = Date.now() + LOCKOUT_MS; }
    return { success: false, message: "El código no es válido o ya fue utilizado." };
  }

  const { license, activationToken, activationId, kind } = result.data;
  const payload = verifyLicense(license, machineId);
  if (!payload || kind !== "server") {
    return { success: false, message: "El código corresponde a otro tipo de activación o la respuesta no es válida." };
  }

  failedAttempts = 0;
  writeStored(baseDirectory, { license, activationToken, activationId, customerRegistered: false, pendingCustomer: null });
  return { success: true, message: "Activación correcta." };
}

// Envía los datos del cliente al terminar la configuración. Si falla, se reintenta luego.
async function registerCustomer(baseDirectory, customer) {
  const stored = readStored(baseDirectory);
  if (!stored || stored.customerRegistered) return;
  const pending = customer || stored.pendingCustomer;
  if (!pending) return;
  try {
    const result = await callFunction("register-customer", {
      activationId: stored.activationId,
      activationToken: stored.activationToken,
      customer: pending,
    });
    if (result.ok) writeStored(baseDirectory, { ...stored, customerRegistered: true, pendingCustomer: null });
    else writeStored(baseDirectory, { ...stored, pendingCustomer: pending });
  } catch (_) {
    writeStored(baseDirectory, { ...stored, pendingCustomer: pending });
  }
}

module.exports = { activate, getLicenseState, registerCustomer };
