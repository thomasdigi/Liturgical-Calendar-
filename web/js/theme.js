// Light and dark: Light, Dark, or Automatic (follow the device). Saved per browser.
import { store } from './util.js';

const choice = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : 'auto';
};

function syncTheme() {
  document.querySelectorAll('#theme button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === choice())));
}

export function initTheme() {
  document.querySelectorAll('#theme button').forEach((b) => (b.onclick = () => {
    const t = b.dataset.theme;
    if (t === 'auto') {
      delete document.documentElement.dataset.theme;
      store.set('theme', 'auto');
    } else {
      document.documentElement.dataset.theme = t;
      store.set('theme', t);
    }
    syncTheme();
  }));
  syncTheme();
}
