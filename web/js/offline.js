// Offline use: install the app, save days ahead, and show when there's no connection.
// The service worker (web/sw.js) serves whatever is in the DATA cache when offline;
// "Save for offline" fills that cache ahead of time for the days the reader picks.
import { altLangId, avail, comboLabel, lang, shownLangId, state } from './state.js';
import { $, monthOf, shift } from './util.js';
import { fmtNum, t } from './ui.js';

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
  const sync = syncNetState;
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();

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
  if (standalone()) how.textContent = t('Installed: the app opens from your home screen.');
  else if (installPrompt) how.textContent = t('Add the app to your home screen or apps.');
  else if (isIOS()) how.textContent = t('In Safari, tap Share, then “Add to Home Screen”.');
  else how.textContent = t('In your browser’s menu, choose “Install app” or “Add to Home Screen”.');
}

async function syncStorage() {
  const out = $('saved-size');
  if (!navigator.storage?.estimate) { out.textContent = ''; return; }
  const { usage } = await navigator.storage.estimate();
  out.textContent = t('Saved on this device: about {mb} MB.', { mb: fmtNum(usage / 1e6, usage > 1e7 ? 0 : 1) });
}

/** Fill in the Offline section of the Settings panel (called when the panel opens). */
export function syncOfflinePanel() {
  syncInstall();
  const ok = canSave();
  $('save-days').disabled = !ok || !!saving;
  $('clear-saved').disabled = !ok;
  $('save-what').textContent = ok
    ? t('{combo}, Latin and {lang}: the Mass, every Hour, the week and month view, and search.', { combo: comboLabel(state.calendar, state.version), lang: lang(shownLangId()).label })
    : t('Saving needs a secure (https) connection.');
  $('save-progress').hidden = !saving;
  syncStorage();
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
    // The shared texts (each psalm and prayer stored once): one pack per language and the Latin.
    const packs = avail?.packs?.[`${state.calendar}/${state.version}`] ?? {};
    for (const l of [...langs, 'latin']) if (packs[l]) files.add(`data/${state.calendar}/${state.version}/${l}/${packs[l]}`);
    const months = new Set(dates.flatMap((d) => [monthOf(shift(d, -6)), monthOf(d), monthOf(shift(d, 6))]));
    for (const m of months) {
      files.add(`data/${state.calendar}/${state.version}/summary/${m}.json`);
      files.add(`data/${state.calendar}/${state.version}/latin/search/${m}.json`);
      for (const l of langs) files.add(`data/${state.calendar}/${state.version}/${l}/search/${m}.json`);
    }
    // First list every file (reading each day's index), then fetch what isn't saved yet.
    for (let i = 0; i < dates.length && !saving.cancelled; i++) {
      status.textContent = t('Finding what to save: day {n} of {total}…', { n: i + 1, total: dates.length });
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
        status.textContent = t('Saving: {done} of {total} files…', { done, total: list.length });
      }
    }));
    status.textContent = saving.cancelled
      ? t('Stopped. What was saved so far stays saved.')
      : failed
        ? t(failed === 1 ? "Saved, except 1 file that couldn't be fetched. Try again to finish." : "Saved, except {n} files that couldn't be fetched. Try again to finish.", { n: failed })
        : t(dates.length === 1 ? 'Saved 1 day from {from}. It opens without a connection.' : 'Saved {n} days from {from}. They open without a connection.', { n: dates.length, from: dates[0] ?? state.date });
  } catch (e) {
    status.textContent = t("Couldn't save: {error}", { error: e.message });
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
  $('save-status').textContent = t('Removed the saved texts. Pages you open are saved again as you read.');
  $('save-progress').hidden = false;
  $('save-bar').value = 0;
  syncStorage();
}

/** Connected or not: the badge in the top bar and the line in Settings. */
export function syncNetState() {
  document.body.classList.toggle('is-offline', !navigator.onLine);
  $('offline-badge').hidden = navigator.onLine;
  $('net-state').textContent = t(navigator.onLine ? 'Connected.' : 'No connection: showing what is saved on this device.');
}

/** Wording for "this day isn't available" when the reason may be the missing connection. */
export const offlineHint = () =>
  navigator.onLine ? '' : ` ${t('You are offline, and this day hasn’t been saved on this device. Use “Save” in Settings when connected.')}`;
