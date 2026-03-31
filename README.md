# Drumline Scores

Score visualization and tracking for the RMPA (Rocky Mountain Percussion Association) circuit. Browse standings, explore caption breakdowns, and track ensemble progression across seasons.

**Live site:** [drumline-scores.pages.dev](https://drumline-scores.pages.dev)

---

## Features

### Standings

View single-show rankings for every class. Each ensemble is displayed as a score card with a caption breakdown bar chart showing Music, Visual, and Effect scores. Expand any ensemble to see the full judge-level recap.

<!-- TODO: add screenshot of standings view -->

### Progression

Track an ensemble's score trends across an entire season with line charts. See caption-level breakdowns and identify scoring patterns from show to show. Includes season summary statistics and penalty analysis.

<!-- TODO: add screenshot of progression view -->

### Cross-Season Comparison

Compare an ensemble's trajectory across multiple years. Useful for seeing long-term growth and how scoring changes across eras.

<!-- TODO: add screenshot of cross-season view -->

### My Ensemble

Set a favorite ensemble for a personalized landing page with quick access to that ensemble's scores, progression, and history. Your selection is saved locally in your browser.

<!-- TODO: add screenshot of my ensemble view -->

### Additional Features

- **Class filtering** — filter by competition class (e.g., Percussion Scholastic A, Percussion Independent World)
- **Year selection** — historical data from 2015 through the current season
- **Share links** — share a direct link to any view using the share button
- **Installable PWA** — install the app to your home screen for quick access and offline viewing
- **Dark theme** — optimized for comfortable viewing in any lighting

---

## How to Use

1. **Open the app** at [drumline-scores.pages.dev](https://drumline-scores.pages.dev).
2. **Select a year** from the year picker to choose the season you want to view.
3. **Choose a class** from the class filter to narrow results to a specific competition class.
4. **Browse standings** by selecting a show to see rankings and score breakdowns.
5. **View progression** by switching to the Progression tab to see how scores trend across the season.
6. **Set a favorite ensemble** by tapping the star icon on any ensemble. This personalizes the My Ensemble view and highlights your ensemble across all views.
7. **Share a view** by tapping the share button to copy a direct link to the current page.
8. **Install the app** — on mobile, use your browser's "Add to Home Screen" option for quick access.

---

## Data Sources

All score data is sourced from publicly available CompetitionSuite recaps for the RMPA circuit. Scores displayed in this app are **unofficial** — for official scores, visit [rmpa.org/scores](https://rmpa.org/scores).

---

## Reporting Issues

Found a bug or incorrect data? Please [open an issue](https://github.com/briangbrown/drumline-scores/issues/new) on GitHub.

When filing an issue, include:

- **For data issues:** the year, show name, ensemble name, and what appears incorrect. If possible, link to the official score source so we can cross-reference.
- **For app bugs:** what you expected to happen, what actually happened, and the device/browser you were using. Screenshots are helpful.

---

## Tech Stack

- [React](https://react.dev/) 19 + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) for builds
- [Tailwind CSS](https://tailwindcss.com/) v4 for styling
- [Recharts](https://recharts.org/) for data visualization
- [Vitest](https://vitest.dev/) for testing
- Deployed on [Cloudflare Pages](https://pages.cloudflare.com/)

---

## Development

```bash
npm install            # Install dependencies
npm run dev            # Start dev server with hot reload
npm test               # Run tests
npm run build          # Type-check and build for production
```

See [CLAUDE.md](CLAUDE.md) for detailed development conventions and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system architecture.

---

## License

This project is not currently published under an open-source license. All rights reserved.
