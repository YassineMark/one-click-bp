/* ============================================================
   ONE CLICK BP — Petit wrapper fetch partagé par toutes les pages
   ============================================================ */

async function handleResponse(res) {
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { body = await res.json(); } catch (e) { body = null; }
  }
  if (!res.ok) {
    const message = (body && body.error) || `Erreur ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function apiGet(path) {
  const res = await fetch(path, { method: 'GET', credentials: 'same-origin' });
  return handleResponse(res);
}

export async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return handleResponse(res);
}

export async function apiPatch(path, body) {
  const res = await fetch(path, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return handleResponse(res);
}

export async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE', credentials: 'same-origin' });
  return handleResponse(res);
}

export async function apiUpload(path, formData) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
  });
  return handleResponse(res);
}

/**
 * Vérifie que l'utilisateur est authentifié. Si non, redirige vers l'accueil
 * (qui affiche le formulaire de connexion) et renvoie null.
 * Sinon renvoie { id, email, fullName }.
 */
export async function requireAuth() {
  try {
    const data = await apiGet('/api/auth/me');
    return data.user;
  } catch (e) {
    window.location.href = 'index.html';
    return null;
  }
}

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function fmtDH(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0 DH';
  return Math.round(v).toLocaleString('fr-FR') + ' DH';
}

export function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return Math.round(v).toLocaleString('fr-FR');
}
