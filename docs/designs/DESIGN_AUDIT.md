# Design Audit Framework — Drumline Scores

A structured framework for evaluating the usability, accessibility, and design quality of the RMPA Score Tracker. This document defines the heuristic checklists, user personas with task walkthroughs, and domain-specific criteria used to audit the application.

---

## How to Use This Document

1. **Pick an audit scope** — a single view (e.g., Standings), a user flow (e.g., "parent finds their kid's score"), or the full app.
2. **Walk through the relevant persona tasks** (Section 2) against the actual UI, noting friction points.
3. **Score each Nielsen heuristic** (Section 1) on a 0–4 severity scale for any violations found.
4. **Check domain-specific criteria** (Section 3) for scoring app requirements.
5. **Record findings** in Section 4's template.

---

## 1. Heuristic Evaluation — Nielsen's 10 Usability Heuristics

For each heuristic, evaluate all screens and interactions. Rate any violations on the severity scale below.

### Severity Scale

| Rating | Meaning |
|--------|---------|
| 0 | Not a usability problem |
| 1 | Cosmetic only — fix if time permits |
| 2 | Minor — low priority fix |
| 3 | Major — important to fix, causes real user friction |
| 4 | Catastrophic — must fix before release, prevents task completion |

### H1: Visibility of System Status

The system should keep users informed about what is going on through appropriate feedback within reasonable time.

**Check:**
- [ ] Loading states are visible when fetching season/show data
- [ ] Active year, class, and view are clearly indicated in the selector pills
- [ ] The currently selected show is obvious in Standings view
- [ ] Users can tell which ensemble is highlighted in Progression charts
- [ ] Offline status is communicated (PWA context)
- [ ] Favorite ensemble state is visually distinct

### H2: Match Between System and the Real World

The system should speak the users' language, with words, phrases, and concepts familiar to the domain.

**Check:**
- [ ] Class abbreviations (PSA, PSO, PSCRA) are understandable — do parents know what these mean?
- [ ] Scoring caption names (Effect-Music, Artistry, Comp/Perf) are clear to non-directors
- [ ] "Progression" vs "Standings" vs "Cross-Season" labels match user mental models
- [ ] Date formats and show names match how the community refers to events
- [ ] "My Ensemble" language is intuitive for setting a favorite
- [ ] Penalty display is clear (what was the penalty for?)

### H3: User Control and Freedom

Users need a clearly marked "emergency exit" to leave unwanted states without extended dialogue.

**Check:**
- [ ] Users can easily navigate back from any deep view (e.g., Recap back to Standings)
- [ ] Changing year/class/view is always one tap away (pill selectors stay visible)
- [ ] Favorite can be changed or removed without friction
- [ ] URL state enables browser back/forward navigation
- [ ] Cross-Season view doesn't trap users (year/class selectors show disabled state clearly)

### H4: Consistency and Standards

Users should not have to wonder whether different words, situations, or actions mean the same thing.

**Check:**
- [ ] Pill component styling is consistent across year, class, and view selectors
- [ ] Score formatting is consistent (decimal places, alignment)
- [ ] Color coding for ensembles is consistent between chart and table
- [ ] Panel/card styling is uniform across all views
- [ ] Caption ordering is consistent everywhere it appears
- [ ] Mobile and desktop layouts follow the same interaction patterns

### H5: Error Prevention

A careful design prevents problems from occurring in the first place.

**Check:**
- [ ] Disabled states on selectors in Cross-Season view prevent invalid navigation
- [ ] Empty states are handled when a class has no data for a show
- [ ] 2020/2021 special seasons show appropriate context rather than confusing gaps
- [ ] URL with invalid year/class/show degrades gracefully

### H6: Recognition Rather Than Recall

Minimize memory load by making objects, actions, and options visible.

**Check:**
- [ ] All navigation options are visible without hidden menus
- [ ] Show dates are displayed alongside show names (not just IDs)
- [ ] Class names expand on selection (abbreviated otherwise) to reduce cognitive load
- [ ] Chart tooltips provide enough context without requiring users to cross-reference tables
- [ ] Season summary is visible alongside progression chart for reference

### H7: Flexibility and Efficiency of Use

Accelerators, unseen by novice users, speed up interaction for experts.

**Check:**
- [ ] Favorite ensemble provides a fast-path for returning users
- [ ] URL deep-linking allows bookmarking specific views
- [ ] Share button enables quick sharing without manual URL copying
- [ ] Caption toggles on Progression view allow directors to drill down quickly
- [ ] PWA install provides home-screen access

### H8: Aesthetic and Minimalist Design

Dialogues should not contain irrelevant or rarely needed information.

**Check:**
- [ ] Score cards show the right amount of information at a glance (not overwhelming)
- [ ] Charts are clean and readable — not overloaded with data series
- [ ] Secondary information (location, judge names) is available but not competing with primary scores
- [ ] Dark theme provides good contrast without eye strain
- [ ] Mobile layout prioritizes the most important data

### H9: Help Users Recognize, Diagnose, and Recover From Errors

Error messages should be expressed in plain language, indicate the problem, and suggest a solution.

**Check:**
- [ ] Network/loading errors show a clear message with retry option
- [ ] "No data" states explain why (e.g., "No shows in this class yet" vs blank screen)
- [ ] Incomplete season (2020) explains the situation clearly
- [ ] 2021 missing effect data is explained, not just a gap

### H10: Help and Documentation

Even though it's better if the system can be used without documentation, it may be necessary to provide help.

**Check:**
- [ ] First-time users can understand the app without a tutorial
- [ ] Caption/scoring terminology is explained or at least not a barrier
- [ ] Class abbreviation meanings are discoverable
- [ ] The disclaimer/link to official scores (rmpa.org) is visible but not intrusive

---

## 2. Persona-Based Cognitive Walkthroughs

For each persona, walk through their primary tasks step by step. At each step, ask:

1. **Will the user know what to do?** (Is the next action obvious?)
2. **Will the user see the correct action?** (Is it visible and discoverable?)
3. **Will the user understand the feedback?** (Does the system confirm progress?)

### Persona A: The Anxious Parent

**Profile:** Mobile-only, low tech confidence, checks scores Saturday night after a competition. Has one kid in Longmont Winter Percussion (PSA class). Wants results fast and wants to share them with family.

**Success metric:** Find their kid's ensemble score and placement within 30 seconds of opening the app.

#### Task A1: "How did Longmont do tonight?"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | Open app (or PWA from home screen) | App loads with the current season | Slow load = abandoned |
| 2 | Recognize which class to select | PSA is selected or identifiable | "PSA" is jargon — will they know? |
| 3 | Find latest show results | Standings view shows tonight's show | Default view may be Progression, not Standings |
| 4 | Locate Longmont in the standings | Scan score cards for "Longmont" | If many ensembles, scrolling needed |
| 5 | Read score and placement | Rank + total clearly visible | Caption breakdown may overwhelm |

#### Task A2: "Share results with family group chat"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | Find share action | Share button is visible | Might not be obvious on mobile |
| 2 | Share link or screenshot | Web Share API or copy URL | Link takes recipient to same view? |
| 3 | Recipient opens link | Deep link loads correct view | Requires URL state to encode class + show |

#### Task A3: "Set Longmont as my favorite so I don't have to search next time"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | Discover the favorite feature | Star icon near ensemble name | Is it visible on the score card? |
| 2 | Tap star | Favorite saved, confirmation shown | What visual feedback confirms it? |
| 3 | Next visit — land on My Ensemble | App opens to their ensemble | Does this happen automatically? |

---

### Persona B: The Stats-Nerd Director

**Profile:** Desktop and mobile, very comfortable with data. Directs a PSA ensemble, checks scores after every show, and digs into caption breakdowns to plan rehearsals. Wants to compare their group against the ensemble ranked immediately above them.

**Success metric:** Identify which caption is their weakest relative to their nearest competitor within 60 seconds.

#### Task B1: "Where are we losing points compared to the group ahead of us?"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | Open app, navigate to their class | PSA Standings for latest show | May need to change from Progression |
| 2 | Find their ensemble and the one above | Adjacent score cards | Cards may not be sorted by rank clearly |
| 3 | Compare caption breakdowns | Caption table or stacked bar chart | Side-by-side comparison not obvious |
| 4 | Identify the gap caption | Visual or numerical comparison | Requires mental math or visual inference |

#### Task B2: "Show me our season trend in Visual caption"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | Switch to Progression view | Line chart with all ensembles | Default shows total, not caption |
| 2 | Toggle to Visual caption | Chart updates to Visual scores | Caption toggles must be discoverable |
| 3 | Find their line | Highlight their ensemble | Spaghetti chart problem — too many lines? |
| 4 | Read the trend | Clear upward/downward trajectory visible | Y-axis scale might make trends hard to read |

#### Task B3: "How do we compare to last year at this point in the season?"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | Switch to Cross-Season view | Multi-year chart loads | How to discover this view? |
| 2 | See their ensemble across years | Lines for each year overlaid or side-by-side | Must select their ensemble |
| 3 | Compare scores at similar show numbers | Aligned by show order or date | Seasons have different numbers of shows |

---

### Persona C: The First-Time Visitor

**Profile:** A friend shared a link. They have no idea what RMPA is, what the classes mean, or how percussion scoring works. They might become a regular user if the experience makes sense.

**Success metric:** Understand what they're looking at and find it interesting within 15 seconds.

#### Task C1: "Someone sent me a link — what is this?"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | Open shared link | Deep link loads specific view | Broken deep links = immediate bounce |
| 2 | Understand the page | Clear visual hierarchy: what sport, what event, who's winning | Jargon-heavy header = confusion |
| 3 | Explore further | Navigate to other classes or views | Unclear selectors = they leave |

#### Task C2: "What do these abbreviations mean? (PSA, PSCRA, Comp, Perf)"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | See abbreviation | Expanded name is visible or discoverable | Active class pill expands, but inactive ones don't |
| 2 | Wonder what Comp/Perf means | Tooltip or label explains caption subcategories | No explanation currently? |
| 3 | Understand the scoring | Context helps them read the numbers | 0-100 scale is intuitive, but caption weights aren't |

---

### Persona D: The Circuit Enthusiast / Alumni

**Profile:** Follows all of RMPA, no "home" ensemble. Browses multiple classes in a session, looks up historical results, and likes to compare across years.

**Success metric:** Answer "Who won PSA in 2022?" within 20 seconds.

#### Task D1: "Who won PSA in 2022?"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | Change year to 2022 | Year pills allow selection | Is 2022 data available and loaded? |
| 2 | Select PSA class | Class pills update for 2022 season | Class IDs may differ across years |
| 3 | View Standings for finals | Final show standings visible | Which show is "finals"? Last one? |
| 4 | Read the #1 ranked ensemble | Clear winner at top | Obvious if sorted by rank |

#### Task D2: "Browse all classes at championships"

| Step | User Action | What Should Happen | Friction Risk |
|------|-------------|-------------------|---------------|
| 1 | Select the championship show | Show selector in Standings | Which show is it? |
| 2 | Flip through classes quickly | Class pills are responsive | Loading delay between class switches? |
| 3 | Compare across classes | Same visual format, easy scanning | Mental context-switching between scoring formats |

---

## 3. Domain-Specific Criteria

Scoring-app-specific requirements beyond general usability.

### Shneiderman's Visual Information Seeking Mantra

> Overview first, zoom and filter, then details on demand.

| Level | What It Means Here | Check |
|-------|-------------------|-------|
| **Overview** | Standings gives the big picture for one show; Progression for the season | [ ] Can users get the gist in under 5 seconds? |
| **Zoom & Filter** | Class selector filters division; show selector filters event; caption toggles filter metric | [ ] Are filter controls always visible and responsive? |
| **Details on Demand** | Recap view for judge-level scores; tooltips for exact values on charts | [ ] Is the detail layer discoverable and easy to exit? |

### Data Integrity Communication

| Criterion | Check |
|-----------|-------|
| Unofficial data disclaimer is visible | [ ] Footer disclaimer present on all views |
| Incomplete seasons are marked | [ ] 2020 shows incomplete indicator |
| Missing data is explained | [ ] 2021 effect gaps show explanation, not blank space |
| Penalties are surfaced | [ ] Timing penalties visible and distinguished from scores |
| Scoring era changes are communicated | [ ] Cross-season view handles era transitions without confusion |

### Mobile Performance

| Criterion | Check |
|-----------|-------|
| Usable on a 375px-wide screen | [ ] No horizontal scroll on primary content |
| Touch targets are at least 44x44px | [ ] Pill buttons, star buttons, chart elements |
| Charts are readable without zooming | [ ] Axis labels, data points, tooltips |
| Page loads under 3s on 3G | [ ] Initial paint with meaningful content |
| PWA install prompt is non-intrusive | [ ] Doesn't block primary content |

### Shareability

| Criterion | Check |
|-----------|-------|
| URLs encode full view state | [ ] Year, class, view, show, highlighted ensemble |
| Shared links load the exact view | [ ] Deep links work from cold start |
| Share button uses Web Share API on mobile | [ ] Falls back to clipboard on desktop |
| Screenshots are legible and self-contained | [ ] Charts include enough context for social media |

---

## 4. Findings Template

Use this template to record audit findings.

```markdown
### Finding: [Short title]

**Heuristic:** H[N] — [Name]
**Severity:** [0–4]
**Persona(s) affected:** [A/B/C/D]
**Screen/Flow:** [Where it occurs]

**Observation:**
[What the problem is — describe what the user experiences]

**Recommendation:**
[What to change — specific, actionable]

**Evidence:**
[File path, screenshot, or user task step reference]
```

### Example Finding

```markdown
### Finding: Class abbreviations are opaque to new users

**Heuristic:** H2 — Match Between System and the Real World
**Severity:** 2
**Persona(s) affected:** A (Parent), C (First-Time Visitor)
**Screen/Flow:** Layout — class selector pills

**Observation:**
Inactive class pills show abbreviations like "PSCRA" and "PSO" with no
explanation. Parents and first-time visitors don't know what these mean and
may not tap the right one.

**Recommendation:**
Add a tooltip or long-press reveal showing the full class name. Alternatively,
show full names on wider screens and abbreviations only on mobile where space
is constrained.

**Evidence:**
`src/layout.tsx:139` — inactive pills use `getClassAbbreviation(cls.name)`
```

---

## 5. Audit Cadence

| Trigger | Scope |
|---------|-------|
| New view added (e.g., Recap, My Ensemble) | Full heuristic review of new view + affected persona tasks |
| Filter/navigation redesign | H1, H3, H5, H6 + all persona Task 1s |
| Before each season launch | Full audit — all heuristics, all personas |
| After user feedback report | Targeted review of reported friction area |
