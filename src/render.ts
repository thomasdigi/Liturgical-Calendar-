/**
 * Renders an Hour by running Divinum Officium's own officium.pl (vendored as a
 * git submodule) as a CGI script. Same output as divinumofficium.com, no network.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { getHour, VERSION, type HourId } from './hours.ts';

const run = promisify(execFile);

export const DO_ROOT = resolve(import.meta.dirname, '../vendor/divinum-officium');
const HORAS_DIR = resolve(DO_ROOT, 'web/cgi-bin/horas');

/** DO wants MM-DD-YYYY. Input is ISO YYYY-MM-DD. */
export function toDoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Bad date "${iso}", expected YYYY-MM-DD`);
  return `${m[2]}-${m[3]}-${m[1]}`;
}

export async function renderHour(isoDate: string, hour: HourId, lang2 = 'English'): Promise<string> {
  if (!existsSync(resolve(HORAS_DIR, 'officium.pl'))) {
    throw new Error('Divinum Officium not found. Run: git submodule update --init --depth 1');
  }
  const params = new URLSearchParams({
    date1: toDoDate(isoDate),
    version: VERSION,
    lang2,
    command: getHour(hour).command,
  });
  const { stdout } = await run('perl', ['officium.pl'], {
    cwd: HORAS_DIR,
    env: { ...process.env, REQUEST_METHOD: 'GET', QUERY_STRING: params.toString(), HTTP_COOKIE: '' },
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
  });
  // CGI output starts with HTTP headers; drop everything before the HTML.
  const start = stdout.search(/<!DOCTYPE|<HTML/i);
  return start >= 0 ? stdout.slice(start) : stdout;
}
