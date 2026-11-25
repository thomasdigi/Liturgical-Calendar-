# Liturgical Calendar

For any date:
- the **Mass**: propers only (Introit, Collect, Epistle, Gradual, Gospel, Offertory, Secret,
  Preface, Communion, Postcommunion), or the full Mass with the Ordinary
- the **Divine Office**: Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline

Versions: **1962 (Rubrics 1960)**, **Divino Afflatu 1954** and **Tridentine 1906**.
Calendars: **General Roman**, **USA** (DO's "Rubrics 1960 - 2020 USA"; 1962 only) and
**Brazil**. (The **Diocese of Rome** is set aside but kept working: in `src/config.ts`,
delete its `hidden: true` to bring it back.)
Texts are in Latin beside the Bea psalter or any of DO's translations, interlinear or
side by side, or one language alone. Light and dark modes.

Where a language has no translation of a part, an ⓘ marks it and the missing lines are
shown in English, or in another language the reader picks.

**Use it on a phone without a connection:** the site installs as an app (Add to Home Screen),
keeps working offline, saves every day you open, and **Offline → Save** downloads the next 7
or 30 days ahead (about 10 MB / 45 MB for one language). See `web/sw.js` and `web/js/offline.js`;
it needs https (GitHub Pages is) or localhost.

**Matins** has an outline bar (Nocturns, lessons 1–9, Te Deum) to jump between lessons, and a
**Martyrology** button opens Prime at the Martyrology.

**Settings panel** (⚙): Light / Dark / Automatic appearance, offline and install, and **Print**
(just the day's heading and the text, always in light colours). Tap a fasting mark (**F**, **A**)
to see whether current Church law (1983 Code) still requires it or it's only suggested by the
traditional discipline.

On a phone, **swipe** left or right to change day (or month). Each day **reopens where you
left off** (the Mass or Hour, and how far down). The month view has a **Today** button and
circles today. **Add to your calendar** (Settings): subscribe to, or download, an iCalendar
feed of every day's feast or of fast days only (`data/<calendar>/<version>/calendar.ics`,
`fasting.ics`, built for the same dates as the site; `src/ical.ts`).

**Chant** (Office): the Gregorian notation of the hymns, antiphons and psalm tones, from DO's
chant edition (`la-gabc`, built like a language), drawn by exsurge (MIT License, shipped with
DO) in place of the Latin; the translation stays beside it. The Mass has no chant edition in DO.

**Sacristan mode** (Settings): a **Sacristan** page with the whole day on one screen. Mass: rank,
colour, Gloria, Credo, Preface, what follows the Epistle, commemorations, whether votive Masses
are allowed. Office: rank, psalms, Matins (nocturns, lessons, Te Deum), Lauds scheme, First or
Second Vespers. Read from DO's own texts for the day at build time (`src/ordo.ts`). The votive
Mass line gives the general rule for the day's class.

**Top bar**: ☰ opens the menu (left panel, still empty), 🔍 the search, ⚙ the Settings (right panel).
**Search** finds feasts and saints as you type (English or Latin names: "St. Lucy", "Christmas";
`web/js/feasts.js`) and, with the Search button, words in the texts.

**Month page**: a wheel of the liturgical year (`web/js/wheel.js`): the seasons around a circle,
an arrow at the day, and the day, its feast and its season in the middle. Tap the ring to go to
that time of year, the middle to open the day.

**E-book** (Settings): an EPUB of a day, 7 days or a month (Mass, Office or both), made in the
browser from the site's texts (`web/js/epub.js`), in the languages, calendar and version chosen.

**Typography** (Settings): four typefaces (Classic, EB Garamond, Source Sans 3, Grenze Gotisch; the
fonts are in `web/fonts`, SIL Open Font License), drop caps off, simple or medieval (UnifrakturMaguntia
in a gilded frame), and for the Latin only: no accents (*Dóminus* → *Dominus*)
and no ligatures (*æ, œ* → *ae, oe*) (`web/js/typography.js`).

**Report a mistake** (Settings, and at the foot of each page): an email or a GitHub issue,
filled in with the day, calendar, version, language and part on screen (`web/js/report.js`).

Fasting marks: **F** fast, **A** abstinence, **P** partial abstinence (a fast day without full
abstinence: meat at the principal meal only). Tap a mark to open its note; tap again to close.

DO's three crosses (✠ sign of the cross, ✙ small cross on the lips, + at the Gospel) are all
shown as ✠.

Holy Week's special services (Palm Sunday, the Triduum, the Easter Vigil) keep their headings.
In the USA texts, where the book prints "N." for the saint's name, the name is added in
brackets (*[Padre Pio]*), but not where "N." stands for the Pope or the bishop.

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
calendars, versions and languages. It also runs by itself when changes are merged into main, and on the 1st of each month
to roll the dates forward. Pages sites should stay under 1 GB. Per calendar/version per day: about 0.7 MB of
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
| `web/` | Viewer: `index.html`, `style.css`, `i18n.js`, the service worker `sw.js`, and `js/` |
| `web/js/main.js` | Start-up and loading; wires the controls to the state |
| `web/js/state.js` | Settings and what's loaded; which languages/versions are available |
| `web/js/data.js` | Fetching and caching the JSON files |
| `web/js/text.js` | Drawing a Mass or Hour (and two side by side in compare mode) |
| `web/js/outline.js` | Matins' Nocturns and lessons, the Martyrology |
| `web/js/controls.js` | Menus and buttons; the translation pop-up; the page address |
| `web/js/calendar.js` | Week strip, month view, fasting marks |
| `web/js/search.js` | Search |
| `web/js/offline.js` | Install, save for offline, offline notice |
| `web/js/theme.js`, `util.js` | Dark mode; small shared helpers |

To update the texts, run `git submodule update --remote vendor/divinum-officium`,
then `npm run build -- <year> --refresh`.
