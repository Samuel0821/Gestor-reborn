const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SUPABASE_URL = "https://fteuajrvyjjdjbphlulp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0ZXVhanJ2eWpqZGpicGhsdWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjcxNjQsImV4cCI6MjA5MTM0MzE2NH0.pDd_gcFHeEHzEOQNgisdZrml2ybRAaMHdS9J48nfLcs";
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

function getLicenseState(baseDirectory, requiredKind = null) {
  const stored = readStored(baseDirectory);
  const payload = stored && verifyLicense(stored.license, getMachineId());
  const supported = payload && ["standalone", "server", "station"].includes(payload.kind);
  return { valid: Boolean(supported && (!requiredKind || payload.kind === requiredKind)), stored, payload };
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

async function activate(baseDirectory, code, appVersion, expectedKind = "standalone", { expectedCustomerId = null } = {}) {
  if (!["standalone", "server", "station"].includes(expectedKind)) {
    return { success: false, message: "Seleccione un tipo de instalación válido." };
  }
  if (expectedKind === "station" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedCustomerId || "")) {
    return { success: false, message: "Verifique primero la conexión con el servidor LAN del cliente." };
  }
  const current = getLicenseState(baseDirectory);
  if (current.valid) {
    if (expectedKind === "station" && current.payload.cid !== expectedCustomerId) {
      return { success: false, message: "La estación está activada para otro cliente. Verifique la dirección del servidor." };
    }
    return current.payload.kind === expectedKind
      ? { success: true, kind: current.payload.kind, message: "Esta instalación ya está activada." }
      : { success: false, message: "Este equipo ya tiene una licencia de otro tipo. Contacte a su asesor antes de cambiarla." };
  }
  if (Date.now() < lockedUntil) {
    return { success: false, message: "Demasiados intentos. Espere un minuto e intente de nuevo." };
  }
  if (!/^[A-Za-z0-9-\s]{10,40}$/.test(String(code || ""))) {
    return { success: false, message: "Ingrese un código de activación válido." };
  }

  const machineId = getMachineId();
  let result;
  try {
    result = await callFunction("redeem", { code, machineId, appVersion, expectedKind, ...(expectedKind === "station" ? { expectedCustomerId } : {}) });
  } catch (_) {
    return { success: false, message: "No se pudo conectar con el servicio de activación. Verifique la conexión a Internet de este equipo." };
  }

  if (!result.ok) {
    if (result.data.error === "wrong_license_customer") {
      return { success: false, message: "El código de estación pertenece a otro cliente. El código no se ha consumido." };
    }
    if (result.data.error === "wrong_license_kind") {
      return { success: false, message: "El código corresponde a otro tipo de instalación. Seleccione el tipo correcto o solicite el código correspondiente. El código no se ha consumido." };
    }
    if (result.status >= 500) return { success: false, message: "El servicio de activación no está disponible. Intente más tarde." };
    failedAttempts += 1;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) { failedAttempts = 0; lockedUntil = Date.now() + LOCKOUT_MS; }
    return { success: false, message: "El código no es válido o ya fue utilizado." };
  }

  const { license, activationToken, activationId, kind } = result.data;
  const payload = verifyLicense(license, machineId);
  if (!payload || payload.kind !== expectedKind || kind !== payload.kind || (kind === "station" && payload.cid !== expectedCustomerId)) {
    return { success: false, message: "El código corresponde a otro tipo de activación o la respuesta no es válida." };
  }

  failedAttempts = 0;
  writeStored(baseDirectory, { license, activationToken, activationId, customerRegistered: false, pendingCustomer: null });
  return { success: true, kind: payload.kind, message: "Activación correcta." };
}

// Envía los datos del cliente al terminar la configuración. Si falla, se reintenta luego.
async function registerCustomer(baseDirectory, customer) {
  const stored = readStored(baseDirectory);
  if (!stored || (stored.customerRegistered && stored.customerId)) return;
  const state = getLicenseState(baseDirectory);
  if (!state.valid || state.payload.kind === "station") return;
  const pending = customer || stored.pendingCustomer || (stored.customerRegistered ? {} : null);
  if (!pending) return;
  try {
    const result = await callFunction("register-customer", {
      activationId: stored.activationId,
      activationToken: stored.activationToken,
      customer: pending,
    });
    if (result.ok) writeStored(baseDirectory, { ...stored, customerRegistered: true, customerId: result.data.customerId, pendingCustomer: null });
    else writeStored(baseDirectory, { ...stored, pendingCustomer: pending });
  } catch (_) {
    writeStored(baseDirectory, { ...stored, pendingCustomer: pending });
  }
}

module.exports = { activate, getLicenseState, registerCustomer };
