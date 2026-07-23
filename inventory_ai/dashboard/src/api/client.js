const BASE_URL = "/api";

function isMockPath() {
  return window.location.pathname.startsWith("/mock");
}

async function request(path, options = {}) {
  if (isMockPath()) {
    throw new Error("Mock database fallback enabled");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("wisright-monitor-token");
      localStorage.removeItem("wisright-monitor-user");
      window.location.href = "/login";
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
};
