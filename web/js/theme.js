// Light and dark mode.
import { $, store } from './util.js';

export const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : !!darkQuery?.matches;
}

export function syncTheme() {
  const dark = isDark();
  $('theme').setAttribute('aria-pressed', String(dark));
  $('theme').querySelector('.theme-label').textContent = dark ? 'Dark mode: on' : 'Dark mode: off';
}

export function initTheme() {
  $('theme').onclick = () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
    syncTheme();
  };
  darkQuery?.addEventListener?.('change', syncTheme);
  syncTheme();
}
