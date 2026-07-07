const TOKEN_KEY = 'sim_admin_token';

// In local dev, Vite's proxy forwards /api to the backend, so a relative path works.
// In production (static build), there is no dev-server proxy, so the deployed backend's
// URL must be supplied at build time via VITE_API_BASE_URL.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { auth = false, ...options } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  if (res.status === 401 && auth) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getEmployees: () => request('/employees', { auth: true }),
  getExpiryAlerts: (days) => request(`/expiry-alerts${days ? `?days=${days}` : ''}`, { auth: true }),
  getProductOverview: () => request('/products/overview'),
  getProducts: (room, rack) => request(`/products?room=${encodeURIComponent(room)}&rack=${encodeURIComponent(rack)}`),
  getProductById: (productId) => request(`/products/${encodeURIComponent(productId)}`),
  getMovementDates: () => request('/movements/dates', { auth: true }),
  getMovementsByDate: (date) => request(`/movements?date=${date}`, { auth: true }),
  getMovementSummary: (room, rack, date) =>
    request(
      `/movements/summary?room=${encodeURIComponent(room)}&rack=${encodeURIComponent(rack)}${date ? `&date=${date}` : ''}`,
      { auth: true }
    ),
  scanRfid: (rfidTag, room) =>
    request('/room-entries/scan', { method: 'POST', body: JSON.stringify({ rfidTag, room }), auth: true }),
  getRoomEntries: (date) => request(`/room-entries?date=${date}`, { auth: true }),
  getCurrentRoomEntries: () => request('/room-entries/current', { auth: true }),
  getCctvOverview: () => request('/cctv/overview', { auth: true }),
  // EventSource can't set an Authorization header, so the token travels as a query param.
  roomEntryStreamUrl: () => `${API_BASE}/api/room-entries/stream?token=${encodeURIComponent(getToken() || '')}`,
};
