/**
 * Local server: serves the viewer and builds any day on demand.
 *   npm start   →  http://localhost:3000
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { getCalendar, getLanguage, getVersion, publicConfig, type CalendarId, type LanguageId, type VersionId } from '../src/config.ts';
import { getDay } from '../src/day.ts';
import { getMonth } from '../src/summary.ts';

const WEB = resolve(import.meta.dirname, '../web');
const PORT = Number(process.env.PORT ?? 3000);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const json = (res: import('node:http').ServerResponse, body: unknown) => {
  res.writeHead(200, { 'content-type': TYPES['.json'] });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    // Same paths as the static build.
    if (url.pathname === '/data/config.json') return json(res, publicConfig());
    const sm = /^\/data\/([\w-]+)\/([\w-]+)\/summary\/(\d{4}-\d{2})\.json$/.exec(url.pathname);
    if (sm) {
      return json(res, await getMonth(getCalendar(sm[1]).id as CalendarId, getVersion(sm[2]).id as VersionId, sm[3]));
    }
    const m = /^\/data\/([\w-]+)\/([\w-]+)\/([\w-]+)\/(\d{4})\/(\d{2}-\d{2})\.json$/.exec(url.pathname);
    if (m) {
      const calendar = getCalendar(m[1]).id as CalendarId;
      const version = getVersion(m[2]).id as VersionId;
      const lang = getLanguage(m[3]).id as LanguageId;
      return json(res, await getDay(`${m[4]}-${m[5]}`, calendar, version, lang));
    }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const path = resolve(WEB, file);
    if (!path.startsWith(WEB + '/') && path !== WEB) throw Object.assign(new Error('forbidden'), { code: 'ENOENT' });
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const notFound = err.code === 'ENOENT' || /^Unknown |calendar has no/.test(err.message);
    res.writeHead(notFound ? 404 : 500, { 'content-type': 'text/plain' });
    res.end(notFound ? 'Not found' : `Error: ${err.message}`);
  }
}).listen(PORT, () => console.log(`Liturgical calendar on http://localhost:${PORT}`));
