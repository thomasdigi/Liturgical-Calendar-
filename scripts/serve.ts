/**
 * Local server: serves the viewer and builds any day on demand.
 *   npm start   →  http://localhost:3000
 * It answers the same paths as the static site (see scripts/site.ts), building
 * what's missing first, so the viewer works the same against either.
 */
import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { getCalendar, getLanguage, getVersion, publicConfig, type CalendarId, type LanguageId, type VersionId } from '../src/config.ts';
import { DATA_DIR, getDay } from '../src/day.ts';
import { getMonth, getYear } from '../src/summary.ts';
import { getSearchMonth } from '../src/search.ts';
import { buildIcs } from '../src/ical.ts';

const WEB = resolve(import.meta.dirname, '../web');
const EXSURGE = resolve(import.meta.dirname, '../vendor/divinum-officium/web/www/js/exsurge.js');
const PORT = Number(process.env.PORT ?? 3000);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const sendJson = (res: ServerResponse, body: unknown) => {
  res.writeHead(200, { 'content-type': TYPES['.json'] });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const notFound = () => Object.assign(new Error('not found'), { code: 'ENOENT' });

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  try {
    if (path === '/data/config.json') return sendJson(res, publicConfig());
    // No data/available.json here: the server can build anything.
    if (path === '/data/available.json') throw notFound();

    // data/<cal>/<ver>/summary/YYYY-MM.json
    const sm = /^\/data\/([\w-]+)\/([\w-]+)\/summary\/(\d{4}-\d{2})\.json$/.exec(path);
    if (sm) return sendJson(res, await getMonth(getCalendar(sm[1]).id as CalendarId, getVersion(sm[2]).id as VersionId, sm[3]));

    // data/<cal>/<ver>/year/YYYY.json: the year index for the feast pages (built if missing)
    const yr = /^\/data\/([\w-]+)\/([\w-]+)\/year\/(\d{4})\.json$/.exec(path);
    if (yr) return sendJson(res, await getYear(getCalendar(yr[1]).id as CalendarId, getVersion(yr[2]).id as VersionId, +yr[3]));

    // data/<cal>/<ver>/(calendar|fasting).ics: last month to two months ahead
    const ic = /^\/data\/([\w-]+)\/([\w-]+)\/(calendar|fasting)\.ics$/.exec(path);
    if (ic) {
      const calendar = getCalendar(ic[1]).id as CalendarId;
      const version = getVersion(ic[2]).id as VersionId;
      const now = new Date();
      const days = [];
      for (let k = -1; k <= 2; k++) {
        const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1)).toISOString().slice(0, 7);
        days.push(...(await getMonth(calendar, version, month)).days);
      }
      res.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8' });
      return res.end(buildIcs(days, { calendar, version, kind: ic[3] as 'calendar' | 'fasting', siteUrl: `http://localhost:${PORT}/` }));
    }

    // data/<cal>/<ver>/<lang|latin>/search/YYYY-MM.json (builds the month's days first if needed)
    const se = /^\/data\/([\w-]+)\/([\w-]+)\/([\w-]+)\/search\/(\d{4}-\d{2})\.json$/.exec(path);
    if (se) {
      const lang = se[3] === 'latin' ? 'latin' : (getLanguage(se[3]).id as LanguageId);
      return sendJson(res, await getSearchMonth(getCalendar(se[1]).id as CalendarId, getVersion(se[2]).id as VersionId, lang, se[4]));
    }

    // data/<cal>/<ver>/<lang|latin>/YYYY/MM-DD/<file>.json
    const dm = /^\/data\/([\w-]+)\/([\w-]+)\/([\w-]+)\/(\d{4})\/(\d{2}-\d{2})\/([\w-]+)\.json$/.exec(path);
    if (dm) {
      const [, cal, ver, lang, year, md, file] = dm;
      const calendar = getCalendar(cal).id as CalendarId;
      const version = getVersion(ver).id as VersionId;
      // The shared Latin is written with the English, so build that if needed.
      const builtLang = (lang === 'latin' ? 'en' : getLanguage(lang).id) as LanguageId;
      await getDay(`${year}-${md}`, calendar, version, builtLang);
      const body = await readFile(resolve(DATA_DIR, calendar, version, lang, year, md, `${file}.json`), 'utf8').catch(() => {
        throw notFound();
      });
      return sendJson(res, body);
    }

    // The chant notation library ships with Divinum Officium (see scripts/site.ts).
    if (path === '/vendor/exsurge.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      return res.end(await readFile(EXSURGE));
    }

    const file = path === '/' ? 'index.html' : path.slice(1);
    const abs = resolve(WEB, file);
    if (!abs.startsWith(WEB + '/') && abs !== WEB) throw notFound();
    const body = await readFile(abs);
    res.writeHead(200, { 'content-type': TYPES[extname(abs)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const missing = err.code === 'ENOENT' || /^Unknown |calendar has no/.test(err.message);
    res.writeHead(missing ? 404 : 500, { 'content-type': 'text/plain' });
    res.end(missing ? 'Not found' : `Error: ${err.message}`);
  }
}).listen(PORT, () => console.log(`Liturgical calendar on http://localhost:${PORT}`));
