import { useEffect, useState } from 'react';
import { getPreferredTheme, setTheme } from '../theme.js';

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getPreferredTheme());

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  function toggle() {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="Toggle light/dark theme">
      {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
    </button>
  );
}
