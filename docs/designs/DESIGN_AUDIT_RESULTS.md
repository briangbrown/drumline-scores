# Design Audit Results — April 2026

Full design audit of the RMPA Score Tracker using the framework defined in [`DESIGN_AUDIT.md`](DESIGN_AUDIT.md). All personas (A–D) evaluated against all 10 Nielsen heuristics plus domain-specific criteria.

---

## Audit Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 3 — Major | 6 | Important to fix, causes real user friction |
| 2 — Minor | 9 | Low priority fix |
| 1 — Cosmetic | 5 | Fix if time permits |
| **Total** | **20** | |

---

## Severity 3 — Major Issues

| # | Issue | Heuristic | Personas | Link |
|---|-------|-----------|----------|------|
| 1 | Score cards have no visual expand indicator | H6 Recognition | A, C | [#108](https://github.com/briangbrown/drumline-scores/issues/108) |
| 2 | No keyboard focus indicators on interactive elements | H7 Flexibility | All | [#109](https://github.com/briangbrown/drumline-scores/issues/109) |
| 3 | Star button click on score card triggers card expansion | H5 Error Prevention | A, B | [#110](https://github.com/briangbrown/drumline-scores/issues/110) |
| 4 | Animations ignore prefers-reduced-motion setting | H7 Flexibility | All | [#111](https://github.com/briangbrown/drumline-scores/issues/111) |
| 5 | Inconsistent ensemble selector in Cross-Season view | H4 Consistency | B, D | [#112](https://github.com/briangbrown/drumline-scores/issues/112) |
| 6 | Loading/error states lack ARIA live regions | H1 Visibility | All | [#113](https://github.com/briangbrown/drumline-scores/issues/113) |

## Severity 2 — Minor Issues

| # | Issue | Heuristic | Personas | Link |
|---|-------|-----------|----------|------|
| 7 | Pinned tooltip can overflow viewport on mobile | H8 Aesthetic | B, D | [#114](https://github.com/briangbrown/drumline-scores/issues/114) |
| 8 | Class abbreviations opaque to new users | H2 Real World | A, C | [#115](https://github.com/briangbrown/drumline-scores/issues/115) |
| 9 | No explanation for 2020/2021 special seasons | H9 Error Recovery | B, D | [#116](https://github.com/briangbrown/drumline-scores/issues/116) |
| 10 | Error messages lack actionable context | H9 Error Recovery | All | [#117](https://github.com/briangbrown/drumline-scores/issues/117) |
| 11 | No undo/confirmation for favorite removal | H3 Control & Freedom | A | [#118](https://github.com/briangbrown/drumline-scores/issues/118) |
| 12 | Chart Y-axis label width causes horizontal scroll on mobile | H8 Aesthetic | A, B | [#119](https://github.com/briangbrown/drumline-scores/issues/119) |
| 13 | Growth value unclear for single-show ensembles | H2 Real World | A, B | [#120](https://github.com/briangbrown/drumline-scores/issues/120) |
| 14 | Caption/scoring terminology not explained | H10 Help | A, C | [#121](https://github.com/briangbrown/drumline-scores/issues/121) |
| 15 | In-memory data cache never expires | H1 Visibility | A, B | [#122](https://github.com/briangbrown/drumline-scores/issues/122) |

## Severity 1 — Cosmetic Issues

| # | Issue | Heuristic | Personas | Link |
|---|-------|-----------|----------|------|
| 16 | Monospace font for all text reduces readability | H8 Aesthetic | All | [#123](https://github.com/briangbrown/drumline-scores/issues/123) |
| 17 | Caption tab border styling inconsistent | H4 Consistency | B | [#124](https://github.com/briangbrown/drumline-scores/issues/124) |
| 18 | My Ensemble CTA button doesn't specify class | H6 Recognition | A | [#125](https://github.com/briangbrown/drumline-scores/issues/125) |
| 19 | Recap view judge-level text too small on mobile | H8 Aesthetic | B | [#126](https://github.com/briangbrown/drumline-scores/issues/126) |
| 20 | No deep linking for caption selection | H7 Flexibility | B | [#127](https://github.com/briangbrown/drumline-scores/issues/127) |

---

## Heuristic Coverage

| Heuristic | Findings | Top Severity |
|-----------|----------|-------------|
| H1 — Visibility of System Status | #113, #122 | 3 |
| H2 — Match Between System and Real World | #115, #120 | 2 |
| H3 — User Control and Freedom | #118 | 2 |
| H4 — Consistency and Standards | #112, #124 | 3 |
| H5 — Error Prevention | #110 | 3 |
| H6 — Recognition Rather Than Recall | #108, #125 | 3 |
| H7 — Flexibility and Efficiency of Use | #109, #111, #127 | 3 |
| H8 — Aesthetic and Minimalist Design | #114, #119, #123, #126 | 2 |
| H9 — Help Users Recognize/Recover From Errors | #116, #117 | 2 |
| H10 — Help and Documentation | #121 | 2 |

## Persona Coverage

| Persona | Findings | Top Severity |
|---------|----------|-------------|
| A — Anxious Parent | #108, #110, #111, #115, #118, #119, #120, #121, #122, #125 | 3 |
| B — Stats-Nerd Director | #110, #112, #114, #116, #119, #120, #122, #124, #126, #127 | 3 |
| C — First-Time Visitor | #108, #115, #121 | 3 |
| D — Circuit Enthusiast | #112, #114, #116 | 3 |
| All | #109, #111, #113, #117, #123 | 3 |

---

## Accessibility Summary (WCAG 2.1)

**Estimated compliance: Level A (partial Level AA)**

Critical gaps for Level AA:
- Missing focus indicators (2.4.7 Focus Visible) — [#109](https://github.com/briangbrown/drumline-scores/issues/109)
- No reduced-motion support (2.3.3 Animation from Interactions) — [#111](https://github.com/briangbrown/drumline-scores/issues/111)
- Missing ARIA live regions (4.1.3 Status Messages) — [#113](https://github.com/briangbrown/drumline-scores/issues/113)

Strengths:
- Semantic HTML (tables, headings, buttons, landmarks)
- Color + text for all status indicators (not color-only)
- High-contrast theme variant available
- Keyboard-operable buttons and controls

---

## Recommended Priority Order

1. **Accessibility fixes** (#109, #111, #113) — required for WCAG AA compliance
2. **Interaction bugs** (#110, #108) — prevent user confusion on core flows
3. **Domain context** (#115, #116, #121) — improve understanding for primary personas
4. **Mobile refinements** (#114, #119, #126) — improve mobile experience
5. **Quality-of-life** (#117, #118, #120, #122) — polish and robustness
6. **Cosmetic** (#123, #124, #125, #127) — fix when time permits
