# Liturgical Calendar

For any date:
- the **Mass**: propers only (Introit, Collect, Epistle, Gradual, Gospel, Offertory, Secret,
  Preface, Communion, Postcommunion), or the full Mass with the Ordinary
- the **Divine Office**: Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline

Versions: **1962 (Rubrics 1960)**, **Divino Afflatu 1954** and **Tridentine 1906**.
Calendars: **General Roman**, **USA** (DO's "Rubrics 1960 - 2020 USA"; 1962 only),
**Brazil** and the **Diocese of Rome**.
Texts are in Latin beside the Bea psalter or any of DO's translations, interlinear or
side by side, or one language alone. Light and dark modes.

Where a language has no translation of a part, an ⓘ marks it and the missing lines are
shown in English, or in another language the reader picks.

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
npm run build -- 2026 --calendar general --version 1962 --lang en   # one combination, whole year
npm run build -- 2026-12-08 --refresh                     # rebuild cached days
npm test                      # runs DO's engine on known days
```

Files are `data/<calendar>/<version>/<lang>/YYYY/MM-DD.json` (one day: the Mass plus all 8 Hours,
about 400 KB) and `data/config.json`. For static hosting, build the dates you want and
serve `web/` with `data/` next to it. A full year in every version and language is
about 19,000 files and 7 GB, so build only what you need (or let `npm start` build on demand).

## Adding a version, calendar or language

Edit `src/config.ts`; the builder, server and viewer pick it up from there.
- **Version:** add an entry with DO's names for it (see `vendor/divinum-officium/web/www/Tabulae/data.txt`).
  The `office` name goes to the breviary script and the `mass` name to the missal script.
- **Calendar:** add an entry with DO's `dioecesis` name (see the `[dioecesis]` list in
  `vendor/divinum-officium/web/www/horas/horas.dialog`).
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
| Українська | 0% (no Office) | 0% | 78% | 100% |
| Dansk, Magyar (Káldi), Polski (newer), עברית | ~100% | 54–98% | 0% (no Mass) | 0% |

Languages are greyed out where DO has no translation at all (Dansk, Magyar Káldi,
Polski newer, Hebrew and the Bea psalter for the Mass; Ukrainian for the Office), and
**Full Mass** is greyed out without DO's translation of the Ordinary. The Bea psalter
uses the standard Latin wherever it has no text of its own.

To find untranslated lines, each day in a language is compared line by line with
DO's English for the same day (`markFallback` in `src/day.ts`).

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
