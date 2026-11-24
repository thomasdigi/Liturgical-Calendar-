# Liturgical Calendar

The 1962 Roman Breviary (Rubrics 1960) for any date: **Lauds, Sext, Vespers and
Compline**, in Latin and English side by side.

The texts are produced by [Divinum Officium](https://www.divinumofficium.com/)'s
own engine (MIT License). It's vendored as a git submodule and run locally, so we
never call their website. That site is behind a Cloudflare bot check anyway.

## Setup

```bash
git submodule update --init --depth 1      # Divinum Officium (~300 MB)
sudo apt-get install -y libcgi-pm-perl libdate-calc-perl libtimedate-perl \
  liburi-perl liburl-encode-perl libalgorithm-diff-perl libcgi-session-perl
npm install
```

## Use

```bash
npm start                     # http://localhost:3000, builds each day on demand
npm run build -- 2026         # pre-build a year into data/2026/MM-DD.json (~1.5 min)
npm run build -- 2026-12-01 2026-12-31 --refresh
npm test                      # runs DO's engine on a few known days
```

For static hosting, run `npm run build -- <year>` and serve `web/` with `data/`
alongside it, at `/data/YYYY/MM-DD.json`.

## How it works

| File | Role |
|---|---|
| `src/render.ts` | Runs DO's `officium.pl` as a CGI script for a date and Hour |
| `src/parse.ts` | **All knowledge of DO's HTML.** Turns it into header + Latin/English sections |
| `src/day.ts` | Builds a whole day (all 4 Hours) and caches the JSON in `data/` |
| `scripts/build.ts` | Builds a date range in parallel |
| `scripts/serve.ts` | Local server: viewer + on-demand day JSON |
| `web/` | Viewer (plain HTML/CSS/JS) |

To update the texts, run `git submodule update --remote vendor/divinum-officium`,
then `npm run build -- <year> --refresh`.
