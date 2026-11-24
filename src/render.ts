/**
 * Renders a Mass or an Hour by running Divinum Officium's own CGI scripts
 * (vendored as a git submodule). Same output as divinumofficium.com, no network.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { getHour, getLanguage, getVersion, type LanguageId, type PartId, type VersionId } from './config.ts';

const run = promisify(execFile);

export const DO_ROOT = resolve(import.meta.dirname, '../vendor/divinum-officium');
const CGI = resolve(DO_ROOT, 'web/cgi-bin');

/** DO wants MM-DD-YYYY. Input is ISO YYYY-MM-DD. */
export function toDoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Bad date "${iso}", expected YYYY-MM-DD`);
  return `${m[2]}-${m[3]}-${m[1]}`;
}

export async function renderPart(isoDate: string, part: PartId, version: VersionId, lang: LanguageId): Promise<string> {
  const v = getVersion(version);
  const lang2 = getLanguage(lang).do;
  const date = toDoDate(isoDate);

  const [dir, script, params] =
    part === 'mass'
      ? ['missa', 'missa.pl', { date, version: v.mass, lang2, command: 'praySanctaMissa', Propers: '1' }]
      : ['horas', 'officium.pl', { date1: date, version: v.office, lang2, command: getHour(part).command }];

  const cwd = resolve(CGI, dir);
  if (!existsSync(resolve(cwd, script))) {
    throw new Error('Divinum Officium not found. Run: git submodule update --init --depth 1');
  }
  const { stdout } = await run('perl', [script], {
    cwd,
    env: {
      ...process.env,
      REQUEST_METHOD: 'GET',
      QUERY_STRING: new URLSearchParams(params).toString(),
      HTTP_COOKIE: '',
    },
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  // CGI output starts with HTTP headers; drop everything before the HTML.
  const start = stdout.search(/<!DOCTYPE|<HTML/i);
  return start >= 0 ? stdout.slice(start) : stdout;
}
