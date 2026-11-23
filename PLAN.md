# Liturgical Calendar — Project Plan

Goal: a 1962 (traditional Roman Rite) liturgical calendar in the spirit of the
FSSPX Ordo (ordo.fsspx.org), built on the open data of Divinum Officium (DO).

**Phase 1 scope:** pick a date → see the day's feast, rank and color, the **Mass
readings**, and the **1962 Breviary** (Divine Office) for that day.

---

## 1. What Divinum Officium gives us

Source: <https://github.com/DivinumOfficium/divinum-officium> — **MIT licensed**,
so we can reuse both data and code (keep the copyright notice).

| Path | Contents |
|---|---|
| `web/www/Tabulae/data.txt` | Rubrical versions. The one we need is **`Rubrics 1960 - 1960`** (= the 1962 books). |
| `web/www/Tabulae/Kalendaria/1960.txt` | Sanctoral calendar for 1960 rubrics (stored as a *diff* against `1955` → `1954` …, so the chain must be resolved). |
| `web/www/Tabulae/Transfer`, `Stransfer` | Rules for feasts moved by the date of Easter / occurrence. |
| `web/www/missa/<Lang>/Tempora`, `Sancti`, `Commune` | Mass propers, one file per day (e.g. `Tempora/Adv1-0.txt` = 1st Sunday of Advent). Sections: `[Rank]`, `[Rule]`, `[Introitus]`, `[Oratio]`, `[Lectio]` (Epistle), `[Graduale]`, `[Evangelium]`, `[Offertorium]`, `[Secreta]`, `[Communio]`, `[Postcommunio]`… |
| `web/www/horas/<Lang>/Tempora`, `Sancti`, `Commune`, `Psalterium` | Office propers, the psalter, hymns, commons. |
| `web/cgi-bin/horas/*.pl`, `missa/*.pl` | Perl engine: precedence, commemorations, and assembly of each Hour. |

Languages: Latin plus English and many others, so Latin/English side by side is possible.

### Notes on the file format
- Each file holds `[Section]` blocks. Inside them: `!` scripture citation, `v.`/`R.`/`V.` versicles, `&Gloria`/`$Qui vivis` macros that expand from shared files, and `@Path:Section` references to other files (heavily used, e.g. a saint's day referencing a Common).
- Some sections carry conditionals such as `(sed rubrica 1960 …)`, which change text depending on the rubrical version.
- `[Rank]` encodes title, class/rank, and a numeric precedence weight.

---

## 2. The hard part (and how to sidestep it in Phase 1)

| Component | Difficulty | Why |
|---|---|---|
| Calendar engine (which feast wins on a date) | **Medium** | Easter computus, temporal cycle, sanctoral, 1960 table of precedence, transfers. Well defined and testable. |
| Mass propers for the day | **Medium–low** | Once the day's office is known, it's one file plus `@` references and Commons. |
| **Breviary hours** (Matins → Compline) | **Very high** | Psalter scheme, antiphons by season, hymns, commemorations, *preces*, suffrages, Matins lessons, first/second Vespers concurrence… DO's Perl is around 20k lines of special cases built up over years. |

**Recommendation:** don't rewrite the Office engine in Phase 1. Use a hybrid approach:

1. **Write our own calendar engine** (TypeScript) for the Ordo view. It's tractable, and owning it gives us full control of the UI and data.
2. **Mass readings:** parse DO's `missa` files directly with our own parser.
3. **Breviary:** run **DO itself as a backend service** (its repo ships a `Dockerfile` and `docker-compose.yml`), call it for a date + version `Rubrics 1960 - 1960` + hour, and restyle the HTML it returns. Later phases can port the Office assembly piece by piece, using DO's output as the test oracle.

Bonus: the DO engine is also the **oracle for our calendar engine**. We can generate DO's ordo for many years and diff it against ours in CI.

---

## 3. Architecture

```
┌──────────────────────────┐      ┌───────────────────────────┐
│  Web app (Next.js/React) │◄────►│  API (Node/TypeScript)     │
│  Month list · Day page   │      │  /api/day/:date            │
└──────────────────────────┘      │  /api/month/:yyyy-mm       │
                                  │  /api/mass/:date           │
                                  │  /api/office/:date/:hour   │
                                  └──────┬──────────────┬──────┘
                                         │              │
                              ┌──────────▼───┐   ┌──────▼──────────────┐
                              │ Calendar     │   │ DO service (Perl,   │
                              │ engine (TS)  │   │ Docker), proxied +  │
                              │ + DO data    │   │ cached; Office HTML │
                              │ (git submod.)│   └─────────────────────┘
                              └──────────────┘
```

- **DO data** comes in as a git submodule (or a pinned download), so upstream corrections are easy to pull in.
- **Build step:** a script turns DO's text files into normalized JSON (resolving `@` references and keeping only the 1960 conditionals), committed or cached.
- **Caching:** the liturgical year is deterministic, so whole years can be precomputed and served statically. A static-site build is entirely viable for the calendar and Mass.

### Day data model (sketch)
```ts
interface LiturgicalDay {
  date: string;              // 2026-12-08
  celebration: string;       // "Immaculate Conception of the BVM"
  latinTitle: string;
  class: 1 | 2 | 3 | 4;      // 1960 classes
  color: 'white'|'red'|'green'|'violet'|'black'|'rose';
  season: string;            // Advent, Christmastide, …
  commemorations: string[];
  massFile: string;          // e.g. "Sancti/12-08"
  officeFile: string;
  notes?: string[];          // Ember day, fast, vigil, etc.
}
```

---

## 4. Milestones

### M0: Setup (≈1 day)
- Repo scaffold (pnpm, TypeScript, Vitest, ESLint/Prettier), DO added as a submodule.
- Stand up DO via `docker compose` locally. Confirm the URL parameters for date, version and hour (`officium.pl`, `missa.pl`).

### M1: Calendar engine (core)
- Easter computus. Temporal cycle keys (`Adv1-0`, `Pent03-2`, `Epi4-0` …) to match DO filenames.
- Load `Kalendaria/1960.txt` by resolving the diff chain (1960 → 1955 → 1954 → … → 1570).
- 1960 precedence and occurrence rules, transfers, vigils, Ember days, *Sundays after Epiphany resumed after Pentecost*.
- Output a `LiturgicalDay` for any date.
- **Test:** compare against DO output for 2020–2035. Target 100% match on celebration + class + color.

### M2: Mass readings
- Parser for DO `missa` files: sections, `@` references, macros, 1960 conditionals.
- For each day, show the Epistle (`[Lectio]`) and Gospel (`[Evangelium]`) with citations, in Latin and English. Optionally the full propers (Introit, Collect, Gradual, Offertory, Secret, Communion, Postcommunion).
- Handle commemorations (extra collects), Ember Saturday's multiple lessons, and the Holy Week specials.

### M3: Breviary (via DO service)
- API proxy: `/api/office/:date/:hour` calls DO with version `Rubrics 1960 - 1960`, then extracts the content and sanitizes it.
- Hours: Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline. Toggles for Latin / English / both.
- Cache aggressively, since the output is deterministic per date+hour+language.

### M4: UI (Ordo look & feel)
- **Month view:** one row per day with date, celebration, class, a color swatch, commemorations and notes (like the FSSPX Ordo).
- **Day view:** a header (feast, class, color, season), then a **Mass** tab (readings / full propers) and an **Office** tab (Hour selector).
- "Today" button, prev/next day, mobile-first, print-friendly.

### M5: Deploy
- Web app on Vercel/Netlify (or fully static). The DO container on a small VM or Fly.io/Render, behind the cache.

### Later phases
- Port the Office assembly to TypeScript hour by hour (start with Compline and the Little Hours, which are the simplest), checked against DO's output.
- Other options the FSSPX Ordo offers: local calendars and propers (by country or congregation), the FSSPX-specific Ordo notes, fasting days.
- iCal feed and offline PWA.

---

## 5. Risks and open questions
- **The ordo.fsspx.org layout couldn't be fetched from this environment** (its host is blocked). UI details in M4 are based on the general shape of an Ordo and should be checked against the live site.
- **The DO Perl engine** is the right short-term dependency but adds a runtime service to host. The alternative is precomputing all Office HTML for a range of years at build time (DO's own `warm-ordo-cache.sh` does something similar), which avoids a live Perl server.
- **Data corrections:** DO's data is maintained and changes. Pin a commit and update deliberately.
- **Translations:** check the source and copyright status of each English text DO ships before redistributing it publicly (the code is MIT, but some translations come from published editions).

## 6. Decisions needed
1. **Stack:** TypeScript/Next.js (assumed above), or something else (Python/Django, SvelteKit…)?
2. **Breviary approach:** host DO as a live service, or precompute at build time?
3. **Languages:** Latin + English for Phase 1?
4. **Mass content:** readings only (Epistle + Gospel), or the full propers?
