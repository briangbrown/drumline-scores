# RMPA Score Tracker — Design Document

## Overview

A mobile-first, publicly accessible web application for visualizing and tracking Rocky Mountain Percussion Association (RMPA) winter percussion scores throughout the season and across historical seasons.

**Core value proposition:** Make RMPA scores easy to find, understand, and share — for directors planning rehearsals, parents checking results, students tracking their group, and fans following the circuit.

---

## User Personas

### Primary Personas

#### 1. Drumline Director / Instructor
The power user. Directors use score data to inform rehearsal planning and track competitive positioning.

**Goals:**
- Compare their ensemble against competitors across shows within a season
- Identify which scoring captions (Music, Visual, Effect) need the most rehearsal focus
- Track season-long progression and growth trends
- Spot where timing penalties are hurting their competitive standing
- Answer: "Are we closing the gap on the group ahead of us?"

**Behaviors:**
- Checks scores after every competition
- Drills into caption-level breakdowns (not just totals)
- Shares data with staff to plan rehearsals
- Wants a "My Ensemble" default view filtered to their group
- Desktop and mobile — desktop for deep analysis, mobile for quick post-show checks

**Key screens:** Progression charts (caption-level), Season Summary, Caption Breakdown

---

#### 2. Score Administrator
The person who gets scores into the system. Initially a single admin (the app creator), potentially expandable.

**Goals:**
- Import scores quickly and accurately after each competition
- Correct errors when they're found
- Add historical seasons (at least 5 years back)
- Maintain data quality across the two scoring formats (marching vs concert)

**Behaviors:**
- Downloads PDFs from rmpa.org/scores after each show
- Runs PDF through an import tool to extract structured data
- Reviews parsed data for accuracy before publishing
- Manages season/show metadata (dates, venues)

**Key screens:** Import tool, Data review/edit, Season management

---

#### 3. Parent / Family Member
Casual user who wants fast answers after competitions.

**Goals:**
- "How did my kid's group do this weekend?" — answered in under 5 seconds
- Track improvement over the season — "are they getting better?"
- Share results with family (screenshot or link)

**Behaviors:**
- Mobile-first, checks Saturday night or Sunday morning
- Wants a favorited/default ensemble so they land on relevant data immediately
- Shares screenshots or links to family group chats
- Low tolerance for complexity — needs clear, glanceable results

**Key screens:** Standings (filtered to their group), Progression chart (their group highlighted)

---

### Secondary Personas

#### 4. Student / Performer
Similar to Parent but with more competitive awareness and social motivation.

**Goals:**
- See their group's scores and placement immediately after awards
- Compare against rival groups they compete against regularly
- Track growth and brag about improvement numbers
- Share results with friends and on social media

**Behaviors:**
- Mobile-only
- Interested in head-to-head comparisons with specific rivals
- Shares via links and screenshots
- More willing to explore data than parents, but less analytical than directors

**Key screens:** Standings, Progression (total scores), Shareable score cards

---

#### 5. Circuit Enthusiast / Alumni
Fans who follow the whole RMPA circuit, not just one ensemble.

**Goals:**
- Browse all classes and all shows freely
- Look up historical results: "Who won PSA in 2022?"
- Follow circuit-wide trends across seasons
- Compare groups across different years

**Behaviors:**
- Browses multiple classes in a single session
- Heavy user of historical/archive features
- May not have a "home" ensemble — wants the full picture
- Desktop or mobile

**Key screens:** Historical season browser, Cross-season comparison, Full standings

---

### Out of Scope (Not Primary Users)

#### 6. Judges / RMPA Officials
They have their own systems (CompetitionSuite). Unlikely to use this app unless it becomes an official tool. No features will be designed specifically for this persona.

---

## Key Design Decisions

### No User Accounts — Local Storage for Personalization
Instead of requiring sign-up/login, personalization features (favorited ensemble, preferred class) will use browser local storage. This keeps the app fully public and frictionless while still enabling "My Ensemble" type experiences.

**Trade-offs:**
- Pro: Zero friction, no auth infrastructure, fully public
- Pro: Works immediately — no onboarding flow
- Con: Preferences don't sync across devices
- Con: Cleared if user clears browser data
- Mitigation: Shareable URLs encode view state, so a user can bookmark their preferred view

### Shareable URLs
Every meaningful view state should be encodable in the URL:
- Season, class, show, view type, selected ensemble
- Example: `/2025/PSA/progression?highlight=Longmont+Winter+Percussion`
- Enables: bookmarking, sharing via text/social, deep linking from external sites

### Multi-Season Support
- Year selector to switch between seasons (minimum 5 years of history)
- URL includes season year
- Data structure supports per-season show lists, class lists, and scores
- Classes and scoring formats may vary slightly across years

### PDF-Based Score Import
- Scores are sourced from rmpa.org/scores (CompetitionSuite recaps published as PDFs)
- PDFs have a consistent format amenable to programmatic parsing
- Import workflow: Download PDF → Run import tool → Review parsed data → Publish
- No web scraping required — manual PDF download is acceptable

---

## Scoring Model

### Competition Structure
- **Season:** A year of competition (e.g., 2025)
- **Show:** A single competition event with a date and venue
- **Class:** A competitive division (e.g., "Percussion Scholastic A")
- **Ensemble:** A performing group that competes within a class

### Score Structure & WGI Caption Eras

Scoring structure has changed over time following WGI judging guideline updates. Two major eras exist for marching classes; concert classes have been unchanged. Full era definitions with verified formulas are in [`data/wgi_caption_eras.js`](/data/wgi_caption_eras.js).

#### Universal Scoring Formula

Every sub-caption is scored 0–100 by the judge. The contribution to the caption total is:

```
caption_score = Σ (sub_score / 100 × sub_point_value)
```

When a caption has a double panel (2 judges), each judge produces a caption score independently, then those are averaged.

#### Marching Era 1: Original 3-Caption (1993–2015)

RMPA confirmed on this structure through 2015. Total = 100 points.

| Caption | Max Pts | % | Sub-Captions | Sub-Point Values |
|---------|---------|---|-------------|-----------------|
| General Effect | 40 | 40% | Mus (Music Effect) + Ovr (Overall Effect) | 20 + 20 (equal) |
| Music | 40 | 40% | Comp (Composition) + Perf (Performance) | 15 + 25 (Perf-heavy) |
| Visual | 20 | 20% | Comp + Perf | 10 + 10 (equal) |

- Music-to-Visual ratio: 80:20 (GE+Music vs Visual)
- GE spans both music and visual effect domains (no separate visual effect judge)
- 1 judge per caption at regionals, 2 judges (double panel) at championships

#### Marching Era 2: Current 4-Caption (2016–present)

RMPA transitioned in 2016 (WGI nationals may have moved as early as 2013). Total = 100 points.

| Caption | Max Pts | % | Sub-Captions | Sub-Point Values |
|---------|---------|---|-------------|-----------------|
| Effect – Music | 30 | 30% | Ovr (Overall) + Mus (Music Effect) | 15 + 15 (equal) |
| Effect – Visual | 20 | 20% | Ovr (Overall) + Vis (Visual Effect) | 10 + 10 (equal) |
| Music | 30 | 30% | Comp (Composition) + Perf (Performance) | 10 + 20 (Perf-heavy) |
| Visual | 20 | 20% | Comp + Perf | 10 + 10 (equal) |

- Music-to-Visual ratio: 60:40 (EM+M vs EV+V) — significantly more visual weight than Era 1
- Effect – Visual is the new caption added in Era 2 (split out from General Effect)
- 9 judges at championships (2 per caption + 1 timing/penalties)

#### Concert Classes (All Years — Unchanged)

Total = 100 points. Used for Concert and Standstill classes.

| Caption | Max Pts | % | Sub-Captions | Sub-Point Values |
|---------|---------|---|-------------|-----------------|
| Music | 50 | 50% | Comp (Composition) + Perf (Performance) | 20 + 30 (Perf-heavy) |
| Artistry | 50 | 50% | Prog (Program) + Ful (Fulfillment) | 20 + 30 (Ful-heavy) |

- Artistry functions as a GE-style sheet
- Caption header labels in HTML vary ("Artistry" vs "Effect") but the structure and formula are the same

#### Caption Name Aliases in HTML Recaps

The same caption appears under different labels across years in the CompetitionSuite HTML. The parser must handle these aliases:

| Canonical Name | HTML Variants |
|---------------|--------------|
| General Effect | "General Effect", "GE" |
| Music (marching) | "Music", "Performance Analysis", "Music Analysis" |
| Visual | "Visual", "Visual Analysis" |
| Effect – Music | "Effect – Music", "Effect - Music", "Effect Music" |
| Effect – Visual | "Effect – Visual", "Effect - Visual", "Effect Visual" |
| Artistry (concert) | "Artistry", "Effect" |

#### 2021 Virtual Season (COVID — One-Off Format)

2020 season was cancelled due to COVID. 2021 ran as a virtual season with a completely different judging framework borrowed from WGI Color Guard. Full definition in [`data/wgi_caption_eras_2021_patch.js`](/data/wgi_caption_eras_2021_patch.js).

**Key differences from all other eras:**
- Sub-caption vocabulary: IMP (Impression) + AN (Analysis) + VAN (Visual Analysis)
- More judges per caption: 4 music + 2 visual (vs 1–2 normally)
- Scores **summed** across judges (not averaged), then total ÷ 2 = final score
- **No effect captions at all** — no GE, no Effect-Music, no Effect-Visual
- Standstill classes used a single undifferentiated "Performance" caption (4 judges × 50pts)

**Marching (2021):** Music (4 judges × 30pts = 120 max) + Visual (2 judges × 40pts = 80 max) → sum ÷ 2 = 100

**Standstill (2021):** Performance (4 judges × 50pts = 200 max) → sum ÷ 2 = 100

**Parser note:** Intermediate totals in the HTML will be unusually large (e.g., 111.15 for a music caption sum instead of ~28 for a normal averaged caption). The parser must recognize 2021 and handle the sum-then-divide mechanic.

#### 2020 Season (COVID — Partial/Cancelled)

The 2020 season was cut short by COVID. Only partial data exists (e.g., contest #3 from Feb 29, 2020). Available data should be included and the season marked as incomplete in `season.json`:

```json
{ "year": 2020, "incomplete": true, "note": "Season cancelled due to COVID-19 after contest #3" }
```

#### 2017 Notes

The 2017 HTML uses different caption labels ("Music Analysis", "Visual Analysis", "Overall Effect") but this is Era 2 (4-caption) structure which RMPA adopted in 2016. The HTML also contains a Winds Independent A class which should be ignored — this app is percussion-only.

#### Cross-Era Comparison: Domain Buckets

To compare scores meaningfully across eras (where caption structures differ), scores are normalized into four stable domains:

| Domain | What It Measures | Era 1 Source | Era 2 Source | 2021 Source |
|--------|-----------------|-------------|-------------|-------------|
| `music_effect` | Entertainment/impact from musical program | GE (50%) | Effect – Music | *empty* |
| `visual_effect` | Entertainment/impact from visual program | GE (50%) | Effect – Visual | *empty* |
| `music_perf` | Musical performance quality + arrangement | Music | Music | Music |
| `visual_perf` | Visual performance quality + spatial composition | Visual | Visual | Visual |

Each domain score is normalized to 0–100 (percentage of caption max). Era 1's General Effect is split 50/50 across `music_effect` and `visual_effect` since it covered both domains with a single judge.

**2021 gap:** The `music_effect` and `visual_effect` domains are empty for 2021 — there is no equivalent data. Cross-season charts showing effect scores will have a gap at 2021. This should be surfaced in the UI (e.g., "No effect data — virtual season format").

#### Additional Fields
- **Total (t):** Sum of caption scores after factoring
- **Penalty (p):** Timing penalties deducted from total (dedicated judge)
- **Rank (r):** Placement within the class at that show

### Known Classes (2025 Season)

| ID | Full Name | Type |
|----|-----------|------|
| PSCRA | Perc. Scholastic Concert Regional A | Concert |
| PSSRA | Perc. Scholastic Standstill Regional A | Concert |
| PSRA | Perc. Scholastic Regional A | Marching |
| PSCA | Perc. Scholastic Concert A | Concert |
| PSSA | Perc. Scholastic Standstill A | Concert |
| PSA | Percussion Scholastic A | Marching |
| PSCO | Perc. Scholastic Concert Open | Concert |
| PSO | Perc. Scholastic Open | Marching |
| PSW | Perc. Scholastic World | Marching |
| PIO | Perc. Independent Open | Marching |
| PIW | Perc. Independent World | Marching |

---

## Views & Features

### 1. Progression View
Line chart showing score trends across shows within a season.
- Toggle between Total score and individual captions
- All ensembles in the class shown, with ability to highlight/focus specific ones
- Season Summary table: shows attended, first/last score, growth, season high
- Timing penalties list

### 2. Standings View
Snapshot of results from a single show.
- Show selector (pills/tabs for each competition)
- Score cards for each ensemble (rank, name, total, penalty)
- Horizontal bar chart for score comparison
- Stacked bar chart for caption breakdown
- Caption scores table with best-in-caption highlighting

### 3. Detailed Recap View (Planned)
Full judge-level score breakdown, similar to the CompetitionSuite recap tables.
- Shows all individual judge scores, subcaption scores, and factored totals
- Designed for directors who want maximum fidelity
- Accessible from the Standings view by tapping/clicking an ensemble's score card
- Judge names displayed as column headers

### 4. My Ensemble (Planned)
Personalized view centered on the user's favorited ensemble.
- Landing page after setting a favorite
- Their group's latest result prominently displayed
- Season progression with their group highlighted
- Quick comparison against groups ranked immediately above/below

### 5. Historical Browser (Planned)
Season/year selector to browse past results.
- Same views available for historical seasons
- Cross-season comparison for an ensemble (how did they do in 2023 vs 2024?)
- Data available back to at least 2012 via CompetitionSuite

### 6. Score Import Tool (Admin)
Utility for the score administrator to import data from CompetitionSuite HTML files.
- Input: Saved HTML file from CompetitionSuite recap page
- Parser extracts all score data including judge-level details
- Review screen shows parsed data for verification, flags unrecognized ensemble names
- Publish to add to the season's JSON data file
- Handles both marching and concert scoring formats automatically

---

## Technical Considerations

### Data Storage
- **Current:** Embedded JSON in the React component
- **Target:** Separate JSON data files **per show**, organized by season
- **Rationale:** Per-show files match the import unit (one HTML recap = one show). If a show's data needs correction, only that file is regenerated — no risk of corrupting other shows.
- **Directory structure:**
  ```
  data/
    ensembles.json              # Global ensemble registry with aliases
    2025/
      season.json               # Season metadata: show list, class list
      2025-02-08-frederick.json # Show #1
      2025-02-15-prairie-view.json
      ...
      2025-03-29-finals.json
    2024/
      season.json
      2024-04-13-championships.json
      ...
  ```
- **Loading strategy:** Load `season.json` on season select (lightweight — just metadata). Load show data on demand as user navigates to specific shows. For progression view, load all shows in the season (can be parallelized).

### URL Routing
- Season, class, show, and view encoded in URL path/params
- Enables bookmarking, sharing, and deep linking
- Client-side routing (React Router or equivalent)

### Responsive Design
- Mobile-first layout
- Charts must be touch-friendly and readable on phone screens
- Tables should scroll horizontally on small screens (already handled in prototype)

### Score Import — CompetitionSuite HTML Parsing

Score data originates from CompetitionSuite recap pages (`recaps.competitionsuite.com/<event-id>.htm`). **HTML is the preferred import format** over PDF — the HTML is well-structured with semantic CSS classes and `data-translate-number` attributes on every score, making it far easier and more reliable to parse than extracted PDF text.

CompetitionSuite has been used since at least 2012, so ~13 years of historical data should be available.

#### Import Workflow
1. Admin downloads the HTML recap page from CompetitionSuite (Save As → HTML)
2. Import tool parses the HTML file
3. Review screen shows parsed data for verification, flags unrecognized ensemble names
4. Admin confirms and data is written as a per-show JSON file

#### Cross-Year HTML Compatibility (2015–2025 verified)

The CompetitionSuite HTML format has been analyzed across 11 files spanning 2015–2025. The core table structure is stable, but key features were added over time:

| Feature | 2015–2018 | 2019–2022 | 2023–2025 |
|---------|-----------|-----------|-----------|
| `data-translate-number` on scores | No | Yes | Yes |
| `score`, `rank` CSS classes | Yes | Yes | Yes |
| `subcaptionTotal`, `captionTotal` | Yes | Yes | Yes |
| `header-division-name` class on `<tr>` | No | No | Yes |
| `round-name` div wrapper | No | No | 2025 only |

**Parser must handle all files from 2015–2025:**
- **Pre-2019 files (2015–2018):** No `data-translate-number` attributes — extract score values from `td.score` text content instead. The `score` and `rank` CSS classes are present in all years.
- **Pre-2023 files (2015–2022):** No `header-division-name` class on division header rows — fall back to matching `td` with `font-weight: bold; font-size: 14px` inline style
- **Empty `data-translate-number=""`:** Occurs in penalty cells (treat as 0)
- **Caption/subcaption names change yearly** — extract dynamically from headers, never hardcode
- **2017 outlier format:** 3-caption structure (Music Analysis, Visual Analysis, Overall Effect) with unique subcaptions (Comp/Ach, Rep/Comm). Parser must handle variable number of caption groups.
- **2021 virtual season:** Completely different scoring mechanic — scores summed across 4+2 judges then divided by 2. Intermediate totals in HTML are ~4× normal. Color Guard sub-caption labels (IMP/AN/VAN). No effect captions. See `wgi_caption_eras_2021_patch.js`.
- **2020 COVID-shortened season:** Only partial season data exists (season cut short after contest #3). Include available data and mark the season as incomplete in `season.json` metadata.
- **Non-percussion classes:** Some HTML files contain Winds classes (e.g., "Winds Independent A" in 2017). Parser must filter to percussion divisions only — skip any class not starting with "Percussion".

#### Judging Caption History in HTML Recaps (2015–2025)

The HTML caption headers use varying labels, but the underlying scoring structure follows the two WGI eras. The parser identifies the era from the year and matches caption headers via aliases.

**Marching classes:**

| Years | HTML Caption Headers | Actual WGI Era |
|-------|---------------------|---------------|
| 2015 | General Effect, Music, Visual | Era 1 (3-caption, confirmed) |
| 2016–2025 | Effect – Music, Effect – Visual, Music, Visual | Era 2 (4-caption, confirmed) |

**Concert/Standstill classes (unchanged across all years):**

| Years | HTML Caption Headers | Notes |
|-------|---------------------|-------|
| 2015–2024 | Music, Artistry | Standard labels |
| 2025 | Effect, Music | "Effect" = "Artistry" (same formula, renamed label) |

**HTML label anomalies (same underlying formula):**

| Year | HTML Label | Actual Caption | Notes |
|------|-----------|---------------|-------|
| 2017 | "Music Analysis" | Music | Label variant, same Comp/Perf structure |
| 2017 | "Visual Analysis" | Visual | Label variant |
| 2017 | "Overall Effect" | General Effect (Era 1) or Effect captions (Era 2) | Needs verification — 2017 is first year of Era 2 at RMPA |
| 2021 | "Music" + "Visual" (with Imp/AN/VAN subcaptions) | Music + Visual (Era 2) | Different subcaption labels but same point structure |
| 2025 | "Effect" (concert) | Artistry | Renamed, same 50pt formula (Prog/Ful = 20/30) |

**Key insight:** The parser should not try to identify the era from caption header labels alone — use the year to determine the era, then use the era definition to interpret the data correctly. The `wgi_caption_eras.js` file provides alias matching for all known label variants.

#### HTML Structure (key selectors)

**Show metadata:**
- Event name: `table > td` with `font-size: 18px; font-weight: bold`
- Venue: `font-style: italic; font-size: 12px` div
- Date: second italic div
- Round: `font-size: 14px` italic div (e.g., "Finals")
- Head judge: `div.chiefJudge`

**Class sections:**
- Class name: `tr.header-division-name > td`
- Each class is a separate table block

**Score data:**
- Scores: `td.score[data-translate-number]` — the numeric value is in the attribute
- Ranks: `td.rank` — the rank number for each score
- Score types distinguished by parent `td` CSS classes:
  - `subcaptionTotal` — factored judge total (*Tot)
  - `captionTotal` — averaged caption total (Tot)
  - No special class — raw subcaption score
- Ensemble name: first `td.content.topBorder.rightBorderDouble` in each row
- Location: second `td.content.topBorder.rightBorderDouble` in each row

**Judge headers:**
- Caption group: `td.captionTotal` in header rows (e.g., "Effect", "Music")
- Judge name: `td.subcaptionTotal` in header rows (e.g., "B. Cappelluti")
- Subcaption labels: bottom header row (e.g., "Prog", "Ful", "*Tot", "Comp", "Perf")

#### Marching Class Table Layout (4 captions, 9 judges)

```
Effect - Music          | Effect - Visual      | Music                | Visual               | Sub   | T&P      |
B.Cappelluti W.Durrett  | R.Zamperini D.Pickett| M.Nevin   S.Stroman  | T.Goddard  P.Butler  | Total | K.Thornton|
Ovr Mus *Tot Ovr Mus *Tot Tot | Ovr Vis Tot Ovr Vis Tot Tot | Comp Perf *Tot Comp Perf *Tot Tot | Comp Perf Tot Comp Perf Tot Tot | | Pen Total
```

- **Effect Music:** 2 judges, each with Ovr + Mus subcaptions → factored *Tot per judge → averaged Tot
- **Effect Visual:** 2 judges, each with Ovr + Vis subcaptions → Tot per judge → averaged Tot
- **Music:** 2 judges, each with Comp + Perf subcaptions → factored *Tot per judge → averaged Tot
- **Visual:** 2 judges, each with Comp + Perf subcaptions → Tot per judge → averaged Tot
- **Sub Total:** Sum of the 4 caption averages
- **Timing & Penalties:** Penalty value, then Final Total

#### Concert/Standstill Class Table Layout (2 captions, 5 judges)

```
Effect                          | Music                          | Sub   | T&P       |
B.Cappelluti      W.Durrett     | M.Nevin       S.Stroman        | Total | K.Thornton|
Prog Ful *Tot   Prog Ful *Tot Tot | Comp Perf *Tot  Comp Perf *Tot Tot |       | Pen Total
```

- **Effect:** 2 judges, each with Prog + Ful subcaptions → factored *Tot per judge → averaged Tot
- **Music:** 2 judges, each with Comp + Perf subcaptions → factored *Tot per judge → averaged Tot
- **Sub Total:** Sum of the 2 caption averages
- **Timing & Penalties:** Penalty value, then Final Total

#### Full Data Extraction (per ensemble per show)

We store **all** score data including individual judge scores. The default UI view shows caption totals, but a detailed recap view exposes the full judge-level breakdown for directors.

**Marching class example (Mountain Range HS, Finals):**
```json
{
  "name": "Mountain Range High School",
  "location": "Westminster, Colorado",
  "rank": 1,
  "total": 86.825,
  "penalty": 0,
  "captions": {
    "em": { "tot": 26.775, "judges": [
      { "name": "B. Cappelluti", "ovr": 91, "mus": 88, "tot": 26.85 },
      { "name": "W. Durrett", "ovr": 92, "mus": 86, "tot": 26.70 }
    ]},
    "ev": { "tot": 17.60, "judges": [
      { "name": "R. Zamperini", "ovr": 87, "vis": 82, "tot": 16.90 },
      { "name": "D. Pickett", "ovr": 92, "vis": 91, "tot": 18.30 }
    ]},
    "m": { "tot": 25.85, "judges": [
      { "name": "M. Nevin", "comp": 87, "perf": 88, "tot": 26.30 },
      { "name": "S. Stroman", "comp": 86, "perf": 84, "tot": 25.40 }
    ]},
    "v": { "tot": 16.60, "judges": [
      { "name": "T. Goddard", "comp": 84, "perf": 83, "tot": 16.70 },
      { "name": "P. Butler", "comp": 83, "perf": 82, "tot": 16.50 }
    ]}
  }
}
```

**Concert class example (Englewood HS, Finals):**
```json
{
  "name": "Englewood High School Percussion Ensemble",
  "location": "Englewood, Colorado",
  "rank": 1,
  "total": 81.750,
  "penalty": 0,
  "captions": {
    "eff": { "tot": 40.15, "judges": [
      { "name": "B. Cappelluti", "prog": 82, "ful": 81, "tot": 40.70 },
      { "name": "W. Durrett", "prog": 78, "ful": 80, "tot": 39.60 }
    ]},
    "mus": { "tot": 41.60, "judges": [
      { "name": "M. Nevin", "comp": 84, "perf": 82, "tot": 41.40 },
      { "name": "S. Stroman", "comp": 86, "perf": 82, "tot": 41.80 }
    ]}
  }
}
```

#### Show-Level Metadata Stored

```json
{
  "id": "fin",
  "name": "RMPA State Championships",
  "date": "2025-03-29",
  "venue": "Clune Arena @ US Air Force Academy",
  "location": "Colorado Springs",
  "round": "Finals",
  "headJudge": "Dave Pickett",
  "sourceUrl": "https://recaps.competitionsuite.com/a68d3f2d-84ed-402d-9cae-350893814007.htm"
}
```

### Deployment
- **Static site** hosted on **Cloudflare Pages**
- No backend required — all data is static JSON loaded client-side
- Build: React app with client-side routing
- Data files: JSON per season, bundled or lazy-loaded
- Reference: User's existing Cloudflare Pages setup at github.com/briangbrown/pickleball-lab

### PWA Considerations
The app should be built as a Progressive Web App (PWA) to provide a native-like experience on mobile without app store distribution.

- **Installable:** Add-to-homescreen on iOS and Android
- **Offline capable:** Cache score data for offline viewing via service worker
- **Fast:** Static assets cached, JSON data lazy-loaded per season
- **Push notifications (future):** PWAs can use the Web Push API for notifications on Android and desktop browsers. iOS Safari added Web Push support in iOS 16.4+ (2023), but it requires the PWA to be installed to the homescreen. This is viable for a "new scores posted" notification feature in the future.

---

## Ensemble Identity & Name Registry

Ensemble names vary across shows and seasons. A global ensemble registry provides automatic matching with manual override capability.

### Observed Name Variations (2022–2025 Championships)

| Canonical Name | Variations |
|---------------|-----------|
| Trojan Percussion | "Fountain-Fort Carson HS Percussion Ensemble" (2022), "Fountain Fort Carson Trojan Percussion Ensemble" (2023-24), "Trojan Percussion Ensemble" (2025) |
| Heritage Indoor Percussion | "Heritage High School" (2022-23), "Heritage Indoor Percussion" (2025) |
| District 49 Indoor Percussion | "District 49 Winter Percussion" (2022), "District 49 Indoor Percussion" (2023-25) |
| Lakewood Winter Percussion | "Lakewood Winter Percussion Ensemble" (2022-23), "Lakewood Winter Percussion" (2024-25) |
| Castle View HS Percussion | "Castleview in Douglas County" (2022), "Castle View High School Percussion Ensemble" (2023-25) |
| Englewood HS Percussion | "Englewood High School" (2022), "Englewood High School Percussion Ensemble" (2023-25) |
| Alameda International | "Alameda International High School" (2022), "Alameda International Indoor Percussion" (2023) |
| Prairie View HS | "Prairie View High School Percussion Ensemble" (2023), "Prairie View High School Winter Percussion" (2025) |

Many ensembles (Arvada HS, Mountain Range HS, Broomfield HS, Blue Knights, Rise, Longmont, Monarch, etc.) are consistent across all 4 years.

### Registry Design

```json
{
  "ensembles": {
    "trojan-percussion": {
      "canonicalName": "Trojan Percussion",
      "location": "Fountain, CO",
      "aliases": [
        "Fountain-Fort Carson High School Percussion Ensemble",
        "Fountain Fort Carson Trojan Percussion Ensemble",
        "Trojan Percussion Ensemble"
      ]
    }
  }
}
```

**Automatic matching strategy:**
1. Exact match against canonical name or any alias
2. Fuzzy match: normalize by stripping common suffixes ("High School", "HS", "Winter Percussion", "Indoor Percussion", "Percussion Ensemble", etc.) and compare core name
3. Location-based hint: if the city/location field matches a known ensemble's location, boost confidence
4. If no match found: flag for manual review during import, admin assigns to existing ensemble or creates new entry
5. Registry is global (not per-season) — an ensemble's identity persists across years even if their name changes

### Stable Ensembles (consistent names 2022–2025)

These ensembles use the same name across all observed years and need no alias mapping:
Arvada HS, Evergreen HS, Mountain Range HS, Broomfield HS, Loveland Indoor Percussion, Centaurus Winter Percussion Ensemble, Monarch Indoor Percussion, Blue Knights Percussion Ensemble, Rise Percussion, Bear Creek HS Percussion Ensemble, Fossil Ridge HS, Columbine HS, Highlands Ranch Falcon Percussion Ensemble, Longmont Winter Percussion, Standley Lake HS, Mountain Vista Winter Percussion, Windsor Percussion Ensemble

## Location Normalization

Location strings in the HTML are highly inconsistent. The import tool should normalize to a standard `"City, ST"` format.

### Observed Issues (across 44 unique location strings, 2015–2025)

| Issue | Examples | Count |
|-------|---------|-------|
| State as full name vs abbreviation | "Denver, Colorado" vs "Denver, CO" | Most cities |
| Missing state entirely | "Broomfield", "Highlands Ranch", "Pueblo" | 5 cities |
| Extra whitespace | "Englewood , Colorado" | 1 |
| Case errors | "Denver, Co" (lowercase) | 1 |
| Full street address | "Windsor High School, 1100 Main St., Windsor, CO 80550" | 3 occurrences |
| School name instead of city | "Widefield High School", "Horizon High School" | 2 |
| Missing comma | "Temecula California" | 1 |
| Out-of-state | "Casper, WY" | 1 |
| Empty location | (blank field) | 2 |

### Normalization Rules

1. Strip street addresses — extract city from known patterns
2. Normalize state to 2-letter abbreviation ("Colorado" → "CO")
3. Fix case ("Co" → "CO")
4. Fix whitespace ("Englewood , Colorado" → "Englewood, CO")
5. Add missing commas ("Temecula California" → "Temecula, CA")
6. Map school names to cities (maintain a small lookup: "Widefield High School" → "Widefield, CO")
7. Store normalized location on the ensemble registry, not per-score — most ensembles always come from the same city

## Class Mobility

- The set of competition classes is mostly stable across seasons, though new classes can appear (e.g., "Percussion Scholastic World" added in 2025) and some classes exist only in certain years
- Ensembles can move between classes across seasons (common) or mid-season (rare)
- When a group moves mid-season, they appear in different classes at different shows — this is handled naturally by the per-class-per-show data structure
- No special handling needed; the data model already supports this

---

## Open Questions

*No blocking open questions remain.* All scoring eras, special seasons, and parsing requirements are documented. The design is ready for implementation planning.

### Resolved Questions Log

| Question | Resolution |
|----------|-----------|
| WGI caption mapping across years | Two marching eras (1993–2015, 2016–present) + concert unchanged. Domain buckets enable cross-era comparison. See `wgi_caption_eras.js`. |
| 2017 era classification | Era 2 (4-caption) with different labels. RMPA transitioned in 2016. |
| 2021 subcaption codes | Color Guard framework (IMP/AN/VAN), scores summed not averaged, no effect captions. See `wgi_caption_eras_2021_patch.js`. |
| 2020 season | Cancelled due to COVID after contest #3. Include partial data, mark incomplete. |
| HTML vs PDF parsing | HTML preferred — `data-translate-number` attributes (2019+), semantic CSS classes. |
| Pre-2019 parsing | Text extraction from `td.score` cells — `score`/`rank` classes present in all years. |
| Data file granularity | Per-show JSON files matching import unit. |
| Ensemble identity | Global registry with aliases + fuzzy matching. |
| Location normalization | Normalize to "City, ST" format. Store on ensemble registry. |
| Deployment | Cloudflare Pages static site. |
| User accounts | None — local storage for favorites. |
| Notifications | Future enhancement via PWA Web Push. |
| Finals/Prelims | Separate competitions, no special handling. |
| Winds classes in HTML | Ignore — app is percussion-only. Parser should skip non-percussion divisions. |

---

## Future Enhancements

- **Push notifications:** Alert users when new scores are published (via PWA Web Push API)
- **Social sharing:** Generate shareable score cards / images for social media
- **Head-to-head comparison tool:** Select two ensembles and see direct comparison across all shared shows
- **Cross-season trends:** Track an ensemble's trajectory across multiple years
- **Web scraping:** Automate PDF/HTML download from rmpa.org/scores (eliminates manual download step)
- **Multi-circuit support:** Expand beyond RMPA to other WGI/regional circuits
