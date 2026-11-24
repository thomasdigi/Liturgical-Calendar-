// The Settings panel (slides in from the side): appearance, offline and install, print.
// New settings go here as sections in index.html (#settings-panel).
import { syncOfflinePanel } from './offline.js';
import { $ } from './util.js';

export function initSettings() {
  const panel = $('settings-panel');
  $('settings-btn').onclick = () => {
    syncOfflinePanel();
    if (panel.showModal) panel.showModal(); else panel.setAttribute('open', '');
  };
  const close = () => (panel.close ? panel.close() : panel.removeAttribute('open'));
  $('settings-close').onclick = close;
  // Tapping the dimmed area outside the panel closes it.
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  $('print-btn').onclick = () => {
    close();
    // Let the panel disappear before the print preview is taken.
    setTimeout(() => window.print(), 150);
  };
}
