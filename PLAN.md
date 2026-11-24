# Liturgical Calendar — Plan: fetching from Divinum Officium

**Approach:** we don't build the liturgy ourselves. We assume
**divinumofficium.com stays live and correct**, fetch the text it generates,
and display it in our own clean, Ordo-style interface.

**Phase 1:** the **Mass** text for each day (1962 rubrics).
**Phase 2** (once Phase 1 works): **Lauds** from the 1962 Breviary.

> An earlier version of this plan (building the calendar engine from scratch)
> is in the git history.

---

## 1. How Divinum Officium serves pages

From reading DO's source (`web/cgi-bin/missa/missa.pl`, `horas/officium.pl`,
`www/missa/missa.dialog`):

| What | Script | Key parameters |
|---|---|---|
| Mass | `https://www.divinumofficium.com/cgi-bin/missa/missa.pl` | `date` (MM-DD-YYYY), `version`, `lang2`, `command` |
| Office (Phase 2) | `https://www.divinumofficium.com/cgi-bin/horas/officium.pl` | `date1` (MM-DD-YYYY), `version`, `lang2`, `command=prayLaudes` |

- **Version** for the 1962 books: `Rubrics 1960 - 1960`.
- **lang2:** the second column. `English` sits beside the Latin, which is always column 1.
- Dates use **`MM-DD-YYYY`** (the script also accepts `/`).
- The page is old-style HTML: a header with a form and options, then a **table where each row is one part of the Mass**, with a Latin cell and an English cell.
- Settings not given in the URL fall back to DO's defaults or cookies, so **every parameter we rely on must always be sent explicitly**.

⚠️ **Not yet verified against the live site.** divinumofficium.com is blocked from
the cloud environment this plan was written in. Step 1 below is to confirm these
URLs work.

---

## 2. Phase 1: Mass text

### Step 1: Confirm the URL (≈1 hour)
Open in a browser, then with `curl`:
```
https://www.divinumofficium.com/cgi-bin/missa/missa.pl?date=12-08-2026&version=Rubrics%201960%20-%201960&lang2=English&command=
```
Check:
- [ ] The right feast appears (Dec 8 = Immaculate Conception).
- [ ] Latin and English appear side by side.
- [ ] The same result comes back with no cookies (`curl` only).
- [ ] Note the exact names of any parameters that differ (e.g. `date` vs `date1`). Save 3–4 sample pages to `samples/` as test fixtures: a Sunday, a 1st-class feast, a feria, and a day in Holy Week.

### Step 2: Fetcher (`src/fetch.ts`)
- `fetchMass(date: Date, lang2 = 'English'): Promise<string>` returns the raw HTML.
- Builds the URL with every parameter set explicitly.
- Sends a clear `User-Agent` naming the project, a timeout, and one retry.
- **Throttled:** at most 1 request per second. DO is a volunteer-run site.

### Step 3: Cache (`cache/mass/YYYY-MM-DD.en.html`)
- Before fetching, check the cache. A given date + version + language never changes, so cached pages stay valid indefinitely.
- Add a `--refresh` option for when DO corrects something.
- This also keeps our site working if DO is briefly down.

### Step 4: Parser (`src/parseMass.ts`)
Turn DO's HTML into clean data:
```ts
interface MassDay {
  date: string;            // "2026-12-08"
  title: string;           // "In Conceptione Immaculata B.M.V." / English title
  rank?: string;           // e.g. "I classis"
  color?: string;          // if DO shows it
  sections: {
    name: string;          // "Introitus", "Oratio", "Lectio", "Evangelium" …
    latin: string;         // cleaned HTML or text
    english: string;
  }[];
  source: string;          // the DO URL, for attribution and a "view on DO" link
}
```
- Use `cheerio` (a server-side HTML parser).
- Drop the header form and navigation. Keep the table rows.
- Normalize DO's formatting (red rubrics, `V.`/`R.` markers, scripture citations) into our own CSS classes. Keep it minimal: don't try to understand the liturgy, just restructure the text.
- **All parsing lives in this one file**, so if DO changes their HTML there's one place to fix.
- Tests: run the parser against the saved `samples/` and snapshot the output.

### Step 5: Pre-fetch a year (`scripts/prefetch.ts`)
- `pnpm prefetch 2026` fetches every day of the year into the cache. That's 365 requests at 1 per second, about 6 minutes.
- Then write `data/mass/2026/MM-DD.json` from the parser.
- Run it once per year (plus whenever there's a correction). The live site never has to call DO.

### Step 6: Minimal viewer
- One page: a date picker, with prev/next/today buttons.
- Shows the title, then each section with Latin and English in two columns (stacked on mobile).
- Reads the static JSON, so any static host works (GitHub Pages, Netlify, Vercel).
- Footer: "Texts from Divinum Officium" with a link to the exact source page.

### Done when
- [ ] Any date in 2026 shows the correct Mass with Latin + English.
- [ ] Spot-checked against DO for about 10 tricky days: Ash Wednesday, the Holy Week days, Easter, Pentecost, Christmas, All Souls, an Ember Saturday, a Sunday with a commemoration.
- [ ] A full-year prefetch runs cleanly.

---

## 3. Phase 2: Lauds (after Phase 1 works)

Same pipeline, reused:
1. Confirm `officium.pl?date1=…&version=Rubrics%201960%20-%201960&lang2=English&command=prayLaudes`.
2. `fetchOffice(date, 'Laudes')` uses the same throttle and cache (`cache/office/laudes/…`).
3. `parseOffice.ts`: DO's Office pages use the same two-column table layout, so much of the Mass parser should carry over.
4. Add a **Mass | Lauds** tab on the day page.
5. Then the other Hours are mostly one more `command` value each (`prayVesperae`, `prayCompletorium`, …).

---

## 4. Later: the Ordo calendar view
Once Mass data exists for a whole year, the **month view** comes almost for free:
the title, rank and colour of each day are already in `data/mass/YYYY/*.json`.
Show one row per day, like ordo.fsspx.org, linking to the day page.

---

## 5. Tech choices
- **TypeScript + Node** for the fetch, parse and prefetch scripts. `cheerio` for HTML, `vitest` for tests.
- **Front end:** a plain static site to begin with (Vite + a little TS or React). Move to Next.js later only if it's needed.
- **Repo layout:**
  ```
  src/        fetch.ts, cache.ts, parseMass.ts, parseOffice.ts
  scripts/    prefetch.ts
  samples/    saved DO pages used as test fixtures
  cache/      raw HTML (git-ignored)
  data/       parsed JSON (committed or built in CI)
  web/        the viewer
  ```

## 6. Being a good guest
- Throttle requests, cache everything, and prefetch rather than calling DO live for every visitor.
- Credit DO on every page and link to the source.
- Consider contacting the DO maintainers (via their GitHub) to tell them about the project. They may also have suggestions or a preferred way to pull data.

## 7. Risks
| Risk | Mitigation |
|---|---|
| DO changes its HTML | All parsing in one module, plus snapshot tests on saved samples |
| DO is down or slow | Everything prefetched and cached; the live site never depends on DO |
| URL parameters differ from what the source suggests | Step 1 verifies them before any code is written |
| Copyright of the English translations | Check DO's sources page before publishing publicly |
