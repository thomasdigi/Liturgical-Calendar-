# Liturgical Calendar

For any date:
- the **Mass**: propers only (Introit, Collect, Epistle, Gradual, Gospel, Offertory, Secret,
  Preface, Communion, Postcommunion), or the full Mass with the Ordinary
- the **Divine Office**: Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline

Versions: **1962 (Rubrics 1960)**, **Divino Afflatu 1954** and **Tridentine 1906**.
Texts are in Latin beside any of DO's 16 translations, or one language alone.

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
npm run build -- 2026-12-01 2026-12-31                    # pre-build every version and language
npm run build -- 2026 --version 1962 --lang en            # one version and language, whole year (~3.5 min)
npm run build -- 2026-12-08 --refresh                     # rebuild cached days
npm test                      # runs DO's engine on known days
```

Files are `data/<version>/<lang>/YYYY/MM-DD.json` (one day: the Mass plus all 8 Hours,
about 400 KB) and `data/config.json`. For static hosting, build the dates you want and
serve `web/` with `data/` next to it. A full year in every version and language is
about 19,000 files and 7 GB, so build only what you need (or let `npm start` build on demand).

## Adding a version or a language

Edit `src/config.ts`; the builder, server and viewer pick it up from there.
- **Version:** add an entry with DO's names for it (see `vendor/divinum-officium/web/www/Tabulae/data.txt`).
  The `office` name goes to the breviary script and the `mass` name to the missal script.
- **Language:** add an entry whose `do` is the folder name under
  `vendor/divinum-officium/web/www/horas/` (e.g. `Italiano`, `Espanol`, `Polski`).

## How complete each language is

Where DO lacks a translation of a text, it shows the English instead. Measured on five
sample days (1962), share of each part in the language itself:

| Language | Psalms | Rest of Office | Mass propers | Ordinary of Mass |
|---|---|---|---|---|
| Español, Français, Italiano, Polski | ~100% | ~100% | 96–100% | 100% |
| Português | 100% | 91% | 100% | 100% |
| Magyar | 100% | 89% | 70% | 100% |
| Deutsch | 100% | 94% | 16% | 99% |
| Čeština | 98% | 81% | 66% | 100% |
| Tiếng Việt | 100% | 78% | 40% | 100% |
| Nederlands | 30% | 61% | 92% | 100% |
| Čeština (Schaller) | 3% | 28% | 62% | 100% |
| Українська | 0% (no Office) | 0% | 78% | 100% |
| Dansk, Magyar (Káldi), Polski (newer), עברית | ~100% | 54–98% | 0% (no Mass) | 0% |

The viewer says when a whole section is in English, and greys out **Full Mass** for
languages without DO's translation of the Ordinary.

## How it works

| File | Role |
|---|---|
| `src/config.ts` | Versions, languages and Hours on offer; reads DO's own language lists |
| `src/render.ts` | Runs DO's `missa.pl` (propers only, or full) or `officium.pl` as a CGI script |
| `src/parse.ts` | **All knowledge of DO's HTML.** Turns a page into header + Latin/second-language sections |
| `src/day.ts` | Builds a whole day (Mass propers, full Mass, 8 Hours) for one version and language, cached in `data/` |
| `scripts/build.ts` | Builds a date range in parallel |
| `scripts/serve.ts` | Local server: viewer + on-demand day JSON |
| `web/` | Viewer (plain HTML/CSS/JS) |

To update the texts, run `git submodule update --remote vendor/divinum-officium`,
then `npm run build -- <year> --refresh`.
