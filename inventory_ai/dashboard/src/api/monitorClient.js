const BASE_URL = "/monitor-api";
const TOKEN_KEY = "wisright-monitor-token";

function isMockPath() {
  return window.location.pathname.startsWith("/mock");
}

async function request(path, options = {}) {
  if (isMockPath()) {
    throw new Error("Mock database fallback enabled");
  }
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const monitorApi = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
};
