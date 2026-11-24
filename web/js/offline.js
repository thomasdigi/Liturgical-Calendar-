// Offline use: install the app, save days ahead, and show when there's no connection.
// The service worker (web/sw.js) serves whatever is in the DATA cache when offline;
// "Save for offline" fills that cache ahead of time for the days the reader picks.
import { altLangId, avail, comboLabel, lang, shownLangId, state } from './state.js';
import { $, monthOf, shift } from './util.js';

const DATA = 'data-v1'; // keep in step with web/sw.js
const canSave = () => 'caches' in window && window.isSecureContext;
let installPrompt = null; // Chrome/Android: the deferred "Install app" prompt
let saving = null; // { cancelled }

export function initOffline() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline use unavailable; the app still works */ });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    syncInstall();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; syncInstall(); });
  const sync = () => {
    document.body.classList.toggle('is-offline', !navigator.onLine);
    $('offline-state').hidden = navigator.onLine;
  };
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();

  $('offline-btn').onclick = openPanel;
  $('save-days').onclick = saveDays;
  $('save-cancel').onclick = () => { if (saving) saving.cancelled = true; };
  $('clear-saved').onclick = clearSaved;
  $('install-app').onclick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    syncInstall();
  };
}

const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function syncInstall() {
  const how = $('install-how');
  $('install-app').hidden = !installPrompt;
  if (standalone()) how.textContent = 'Installed: the app opens from your home screen.';
  else if (installPrompt) how.textContent = 'Add the app to your home screen or apps.';
  else if (isIOS()) how.textContent = 'In Safari, tap Share, then “Add to Home Screen”.';
  else how.textContent = 'In your browser’s menu, choose “Install app” or “Add to Home Screen”.';
}

async function syncStorage() {
  const out = $('saved-size');
  if (!navigator.storage?.estimate) { out.textContent = ''; return; }
  const { usage } = await navigator.storage.estimate();
  out.textContent = `Saved on this device: about ${(usage / 1e6).toFixed(usage > 1e7 ? 0 : 1)} MB.`;
}

function openPanel() {
  syncInstall();
  const ok = canSave();
  $('save-days').disabled = !ok || !!saving;
  $('clear-saved').disabled = !ok;
  $('save-what').textContent = ok
    ? `${comboLabel(state.calendar, state.version)}, Latin and ${lang(shownLangId()).label}: the Mass, every Hour, the week and month view, and search.`
    : 'Saving needs a secure (https) connection.';
  $('save-progress').hidden = !saving;
  syncStorage();
  const dlg = $('offline-dlg');
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}

/** The data files a day needs, for one language: its index, every part, and the shared Latin. */
async function dayFiles(cache, langId, date) {
  const dir = `data/${state.calendar}/${state.version}/${langId}/${date.slice(0, 4)}/${date.slice(5)}`;
  const latin = `data/${state.calendar}/${state.version}/latin/${date.slice(0, 4)}/${date.slice(5)}`;
  const indexUrl = `${dir}/index.json`;
  let index;
  const saved = await cache.match(indexUrl);
  if (saved) index = await saved.json();
  else {
    const res = await fetch(indexUrl);
    if (!res.ok) return []; // not on this site
    await cache.put(indexUrl, res.clone());
    index = await res.json();
  }
  return index.parts.flatMap((p) => [`${dir}/${p.id}.json`, `${latin}/${p.id}.json`]);
}

async function saveDays() {
  if (!canSave() || saving) return;
  const count = Number($('save-range').value) || 7;
  saving = { cancelled: false };
  $('save-days').disabled = true;
  $('save-progress').hidden = false;
  $('save-cancel').hidden = false;
  const bar = $('save-bar');
  const status = $('save-status');
  navigator.storage?.persist?.().catch(() => {});
  try {
    const cache = await caches.open(DATA);
    let dates = Array.from({ length: count }, (_, i) => shift(state.date, i));
    if (avail) dates = dates.filter((d) => d >= avail.first && d <= avail.last);
    // The chosen language, and the alternative used where it has gaps.
    const langs = [...new Set([shownLangId(), altLangId()])];
    const files = new Set(['data/config.json', 'data/available.json']);
    const months = new Set(dates.flatMap((d) => [monthOf(shift(d, -6)), monthOf(d), monthOf(shift(d, 6))]));
    for (const m of months) {
      files.add(`data/${state.calendar}/${state.version}/summary/${m}.json`);
      files.add(`data/${state.calendar}/${state.version}/latin/search/${m}.json`);
      for (const l of langs) files.add(`data/${state.calendar}/${state.version}/${l}/search/${m}.json`);
    }
    // First list every file (reading each day's index), then fetch what isn't saved yet.
    for (let i = 0; i < dates.length && !saving.cancelled; i++) {
      status.textContent = `Finding what to save: day ${i + 1} of ${dates.length}…`;
      for (const l of langs) for (const f of await dayFiles(cache, l, dates[i])) files.add(f);
    }
    const list = [...files];
    let done = 0;
    let failed = 0;
    const queue = [...list];
    await Promise.all(Array.from({ length: 6 }, async () => {
      for (let url = queue.shift(); url && !saving.cancelled; url = queue.shift()) {
        try {
          if (!(await cache.match(url))) {
            const res = await fetch(url);
            if (res.ok) await cache.put(url, res);
            else if (res.status !== 404) failed++;
          }
        } catch { failed++; }
        done++;
        bar.value = done / list.length;
        status.textContent = `Saving: ${done} of ${list.length} files…`;
      }
    }));
    status.textContent = saving.cancelled
      ? 'Stopped. What was saved so far stays saved.'
      : failed
        ? `Saved, except ${failed} file${failed === 1 ? '' : 's'} that couldn't be fetched. Try again to finish.`
        : `Saved ${dates.length} day${dates.length === 1 ? '' : 's'} from ${dates[0] ?? state.date}. They open without a connection.`;
  } catch (e) {
    status.textContent = `Couldn't save: ${e.message}`;
  } finally {
    saving = null;
    $('save-days').disabled = !canSave();
    $('save-cancel').hidden = true;
    syncStorage();
  }
}

async function clearSaved() {
  if (!canSave()) return;
  await caches.delete(DATA);
  $('save-status').textContent = 'Removed the saved texts. Pages you open are saved again as you read.';
  $('save-progress').hidden = false;
  $('save-bar').value = 0;
  syncStorage();
}

/** Wording for "this day isn't available" when the reason may be the missing connection. */
export const offlineHint = () =>
  navigator.onLine ? '' : ' You are offline, and this day hasn’t been saved on this device. Use “Save for offline” when connected.';
