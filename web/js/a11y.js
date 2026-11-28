// Accessibility (Settings → Accessibility, folded away for those who don't need it):
// high contrast, a dyslexia-friendly typeface (OpenDyslexic), and less motion. Saved on the
// device and applied before the page first appears (see the script in index.html).
import { store } from './util.js';

const OPTIONS = [
  // [checkbox id, saved name, attribute on <html>, its value]
  ['a11y-contrast', 'a11yContrast', 'contrast', 'high'],
  ['a11y-dyslexia', 'a11yDyslexia', 'dyslexia', 'on'],
  ['a11y-motion', 'a11yMotion', 'motion', 'reduce'],
];

/** Less motion: chosen here, or asked for by the device. */
export const reducedMotion = () =>
  document.documentElement.dataset.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initA11y() {
  for (const [id, key, attr, value] of OPTIONS) {
    const box = document.getElementById(id);
    box.checked = store.get(key, 'off') === 'on';
    box.onchange = () => {
      store.set(key, box.checked ? 'on' : 'off');
      if (box.checked) document.documentElement.dataset[attr] = value;
      else delete document.documentElement.dataset[attr];
    };
  }
}
