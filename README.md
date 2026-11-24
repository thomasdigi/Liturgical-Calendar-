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

Also: **search** across the texts (Mass propers and the Hours, accent-insensitive, phrases in
quotes), **compare** mode (the same Mass or Hour in another calendar or version, side by
side), labelled **commemorations and suffrages**, the **votive offices** (Office of the Dead:
Matins, Lauds, Vespers; Little Office of Our Lady; Our Lady on Saturday, on Saturdays), a
**month view** (Ordo-style list of every day), a **this week** strip, **fasting and
abstinence** markers (general law of the 1917 Code: Fridays, Lent, Ember days and the four
vigils; local law may differ), **text size**, a **reading mode** (hides verse numbers, notes
and instructions), and a **jump-to** menu. The ⓘ pop-up is written in the language whose
translation is missing (`web/i18n.js`; these translations would benefit from review by
native speakers).

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
npm run build -- 2026-12 … --votive none                  # skip the votive offices (smaller)
npm test                      # runs DO's engine on known days
```

Month summaries are `data/<calendar>/<version>/summary/YYYY-MM.json` (built alongside
the days). Each day is a folder, `data/<calendar>/<version>/<lang>/YYYY/MM-DD/`, holding
`index.json` (header, list of parts, and the Masses on days with several) and one file per
part (`mass`, `massFull`, each Hour, and `mass-2`, `massFull-3`, … for the other Masses of
Christmas, All Souls, Holy Thursday and the long/short forms). The Latin is the same in
every language, so it is stored once, in `data/<calendar>/<version>/latin/…`. Opening an
Hour loads about 30–60 KB. A full year in every calendar, version and language would be
several GB, so build only what you need (see Publishing) or let `npm start` build on demand.

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

## Publishing the site

The site is static: the viewer plus pre-built JSON. Any static host works.

**GitHub Pages (automatic):** `.github/workflows/pages.yml` builds the texts with DO's engine
and publishes them. One-time setup: repository **Settings → Pages → Source: GitHub Actions**.
Then **Actions → Build and publish site → Run workflow**, choosing how many months, which
calendars, versions and languages. It also re-runs on the 1st of each month to roll the dates
forward. Pages sites should stay under 1 GB. Per calendar/version per day: about 0.7 MB of
shared Latin plus about 0.65 MB per language (0.45 MB each without votive offices), search
index included. The defaults, three months of General 1962 in 8 languages with all votive
offices, come to about 0.55 GB.

**By hand:**
```bash
npm run build -- 2026-12-01 2027-02-28 --calendar general --version 1962 --lang en,fr,es
npm run site          # assembles dist/ (viewer + data + data/available.json)
```
then upload `dist/`. `data/available.json` tells the viewer which dates, calendars, versions
and languages were built; anything else is greyed out as "not on this site".

**Everything, on demand:** run `npm start` on a server with Perl (see Setup). It builds any
day the first time it's asked for and caches it.

## How it works

| File | Role |
|---|---|
| `src/config.ts` | Versions, languages and Hours on offer; reads DO's own language lists |
| `src/render.ts` | Runs DO's `missa.pl` (propers only, or full) or `officium.pl` as a CGI script |
| `src/parse.ts` | **All knowledge of DO's HTML.** Turns a page into header + Latin/second-language sections |
| `src/fasting.ts` | Fasting and abstinence rules (1917 Code) and the date of Easter |
| `src/search.ts` | Search index: plain text per month (Latin shared, plus each language) |
| `src/summary.ts` | A month at a glance: feast, class, colour, commemorations, fasting |
| `scripts/site.ts` | Assembles the static site in `dist/` |
| `src/day.ts` | Builds a whole day (Mass propers, full Mass, 8 Hours) for one version and language, cached in `data/` |
| `scripts/build.ts` | Builds a date range in parallel |
| `scripts/serve.ts` | Local server: viewer + on-demand day JSON |
| `web/` | Viewer (plain HTML/CSS/JS) |

To update the texts, run `git submodule update --remote vendor/divinum-officium`,
then `npm run build -- <year> --refresh`.
