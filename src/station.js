const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serverUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw Error('Indique la dirección del servidor LAN.');
  let url;
  try { url = new URL(raw.includes('://') ? raw : `https://${raw}`); }
  catch { throw Error('La dirección del servidor no es válida.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw Error('Use la dirección HTTPS del servidor, sin usuario, contraseña ni rutas adicionales.');
  }
  const authority = raw.replace(/^[a-z]+:\/\//i, '').split('/')[0];
  if (!url.port && !/:\d+$/.test(authority)) url.port = '47821';
  return url.origin;
}

async function readHealth(value, request = fetch) {
  const apiUrl = serverUrl(value);
  let response;
  try { response = await request(`${apiUrl}/health`, { signal: AbortSignal.timeout(10000), redirect: 'error' }); }
  catch { throw Error('No se pudo conectar al servidor. Revise la dirección, la red y el certificado de confianza instalado en esta estación.'); }
  if (!response.ok) throw Error('El servidor LAN no está disponible.');
  const health = await response.json();
  if (health?.service !== 'GestorFX') throw Error('La dirección no corresponde a un servidor GestorFX.');
  return { apiUrl, health };
}

function matchesServer(state, health) {
  return Boolean(state.valid && state.payload?.kind === 'station' && health?.installationCompleted
    && health.serverKind === 'server' && UUID.test(health.customerId || '') && state.payload.cid === health.customerId);
}

async function connect({ apiUrl, code }, { request, licensing, directory, version }) {
  const server = await readHealth(apiUrl, request);
  if (!server.health.installationCompleted) throw Error('Complete primero la activación y configuración del servidor LAN.');
  if (server.health.serverKind !== 'server' || !UUID.test(server.health.customerId || '')) {
    throw Error('El servidor debe estar actualizado y tener su cliente registrado antes de activar estaciones.');
  }
  const result = await licensing.activate(directory, code, version, 'station', { expectedCustomerId: server.health.customerId });
  if (!result.success) return result;
  if (!matchesServer(licensing.getLicenseState(directory, 'station'), server.health)) {
    throw Error('La licencia de esta estación no corresponde al cliente del servidor.');
  }
  return { success: true, kind: 'station', apiUrl: server.apiUrl, message: 'Estación activada y conectada al servidor LAN.' };
}

module.exports = { serverUrl, readHealth, matchesServer, connect };
