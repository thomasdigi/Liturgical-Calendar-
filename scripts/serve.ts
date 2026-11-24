/**
 * Local server: serves the viewer and builds any day on demand.
 *   npm start   →  http://localhost:3000
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { getDay } from '../src/day.ts';

const WEB = resolve(import.meta.dirname, '../web');
const PORT = Number(process.env.PORT ?? 3000);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    // Same path layout as the static build: /data/YYYY/MM-DD.json
    const m = /^\/data\/(\d{4})\/(\d{2}-\d{2})\.json$/.exec(url.pathname);
    if (m) {
      const day = await getDay(`${m[1]}-${m[2]}`);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(day));
    }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const path = resolve(WEB, file);
    if (!path.startsWith(WEB)) throw Object.assign(new Error('forbidden'), { code: 'ENOENT' });
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    const notFound = (e as NodeJS.ErrnoException).code === 'ENOENT';
    res.writeHead(notFound ? 404 : 500, { 'content-type': 'text/plain' });
    res.end(notFound ? 'Not found' : `Error: ${(e as Error).message}`);
  }
}).listen(PORT, () => console.log(`Liturgical calendar on http://localhost:${PORT}`));
