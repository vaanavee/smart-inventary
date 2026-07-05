const TOKEN_KEY = 'sim_admin_token';

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

  const res = await fetch(`/api${path}`, { ...options, headers });
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
  getMovementDates: () => request('/movements/dates', { auth: true }),
  getMovementsByDate: (date) => request(`/movements?date=${date}`, { auth: true }),
  getMovementSummary: (room, rack, date) =>
    request(
      `/movements/summary?room=${encodeURIComponent(room)}&rack=${encodeURIComponent(rack)}${date ? `&date=${date}` : ''}`,
      { auth: true }
    ),
};
