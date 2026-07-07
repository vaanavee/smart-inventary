const STORAGE_KEY = 'sim_theme';

export function getStoredTheme() {
  return localStorage.getItem(STORAGE_KEY);
}

export function getPreferredTheme() {
  return getStoredTheme() || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

// Called once before React renders so there's no flash of the wrong theme.
export function initTheme() {
  applyTheme(getPreferredTheme());
}
