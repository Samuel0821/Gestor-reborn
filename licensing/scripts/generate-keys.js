// Genera el par de claves Ed25519 para firmar licencias.
// La clave privada va SOLO en los secretos de Supabase (LICENSE_PRIVATE_KEY).
// La clave pública es la que se incluye en la app.
const { generateKeyPairSync } = require("crypto");

const { privateKey, publicKey } = generateKeyPairSync("ed25519");

console.log("LICENSE_PRIVATE_KEY (secreta, no la compartas ni la subas a git):");
console.log(privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"));
console.log("");
console.log("LICENSE_PUBLIC_KEY (pública, va en la app):");
console.log(publicKey.export({ type: "spki", format: "der" }).toString("base64"));
