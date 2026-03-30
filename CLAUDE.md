# CLAUDE.md — drumline-scores

Agent instructions for Claude Code working in this repository.

For the full design document (personas, scoring model, data architecture, parsing spec) see **[`docs/designs/DESIGN.md`](docs/designs/DESIGN.md)**.

For the system overview (directory structure, data flow, module responsibilities) see **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**. **Update ARCHITECTURE.md when adding modules, changing data flow, or restructuring directories.**

---

## Branch Protection

The `main` branch is protected — **all changes must go through a pull request**. Direct pushes to `main` are rejected.

- Always create a feature branch, push it, and open a PR.
- Do not attempt to `git push` to `main` directly.

---

## Development Commands

```bash
npm run dev            # Start Vite dev server (hot reload)
npm run build          # tsc type-check + Vite production build
npm run preview        # Serve the dist/ build locally
npm test               # Run Vitest unit tests
```

**Always run `npm test && npm run build` after code changes** to confirm all tests pass and the build compiles.

---

## Code Style

All TypeScript and React code must follow the conventions in **[`.claude/typescript-style-guide.md`](.claude/typescript-style-guide.md)** (sourced from <https://mkosir.github.io/typescript-style-guide/>). The subsections below specify how those rules apply to this codebase and add project-specific guidance.

### TypeScript

The project uses `strict: true` plus additional strictness flags. **All code must be strictly typed — no `any`, no type assertions, no `@ts-ignore`.**

Key tsconfig flags in effect:

```jsonc
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"verbatimModuleSyntax": true,   // use `import type` for type-only imports
"erasableSyntaxOnly": true,      // no enums, no namespaces (use const objects / union types)
"noUncheckedSideEffectImports": true
```

- **`type` over `interface`** — use `type` for all type definitions; never `interface`.
- **`Array<T>` over `T[]`** — use generic array syntax throughout.
- **`import type`** — required for all type-only imports (enforced by `verbatimModuleSyntax`).
- **No `any`** — use `unknown` + narrowing instead.
- **No type assertions** — fix the type; do not use `as` or `!` to silence errors.
- **No enums** — use union string literals or `as const` objects (enforced by `erasableSyntaxOnly`).
- **No `namespace`** — the codebase uses plain ES modules.
- **`as const`** — use for object/array constants to narrow types and ensure immutability.

### React

- Target **React 19** patterns. Use the React compiler mental model: keep components pure, avoid manual memoisation unless profiling proves it necessary.
- Use `StrictMode` — do not remove it.
- Prefer function components with hooks. No class components.
- Do not use `React.FC` — annotate props with an inline `type` and let the return type be inferred.
- Event handlers: prefer inline arrow functions for simple cases; extract named handlers only when the handler is non-trivial or referenced more than once.
- Event props use `on*` prefix; handler functions use `handle*` prefix.
- `useEffect` for external effects only (DOM mutations, subscriptions). Do not use `useEffect` for derived state — compute it inline or with `useMemo`.
- Keep sub-components in the same file unless a component grows large enough to justify extraction.

### Naming

| Category | Convention | Example |
|---|---|---|
| Local variables | camelCase | `ensembles`, `filteredScores` |
| Booleans | `is`/`has` prefix | `isMarching`, `hasCaption` |
| Constants | UPPER_SNAKE_CASE | `MARCHING_ERAS`, `CAP_COLORS` |
| Functions | camelCase | `getProgression()`, `calcCaptionScore()` |
| Types | PascalCase | `EnsembleScore`, `CaptionDef` |
| React components | PascalCase | `ScoreCard`, `ProgressionChart` |
| Prop types | Component name + `Props` | `ScoreCardProps` |
| React hooks | `use` prefix | `useFavoriteEnsemble()` |

### Exports

**Use named exports exclusively — no default exports.**

```typescript
// ❌ Avoid
export default function ScoreCard() {}

// ✅ Use
export function ScoreCard() {}
export const calcCaptionScore = () => {}
```

### CSS & Styling

- Use **Tailwind CSS v4** utility classes for all layout and styling.
- Do not add inline `style={{}}` props unless a value is genuinely dynamic (e.g., computed from data at runtime). Use Tailwind classes for static styles.
- Mobile-first responsive design — start with mobile layout, add breakpoints for larger screens.

### Formatting

- **No linter config file** is committed — TypeScript strict mode serves as the primary correctness gate. Run `npm run build` to check.
- Prettier is the formatter. Match existing indentation (2 spaces) and quote style (single quotes for JS/TS, double quotes in JSX attributes).
- Comment non-obvious scoring formulas and domain-specific logic. Keep comments factual and brief. Favour expressive code over comments — comments should explain *why*, not *what*.

---

## Testing

The project uses **Vitest** for unit testing.

```bash
npm test           # Run all tests once (CI mode)
npx vitest         # Run in watch mode during development
```

### What to test

- **All scoring functions** (caption calculation, domain normalization, cross-era comparison) must have tests. Pure math is the highest-value test target.
- **Parser functions** — HTML parsing, score extraction, ensemble name matching.
- **Any new pure TypeScript utility** must ship with tests.
- **React components** do not require tests unless explicitly asked.

### Test conventions

- Test files are colocated with the module they test: `foo.ts` → `foo.test.ts`.
- Use `describe` blocks to group tests by function, `it` blocks for individual cases.
- Follow the `it('should … when …')` naming pattern.
- Import from `vitest`: `import { describe, it, expect } from 'vitest'`
- Cover: empty/edge inputs, expected happy-path values, and numerical correctness (use `toBeCloseTo` for floating-point).
- Use the test vectors in `data/wgi_caption_eras.js` to validate scoring formula implementations.
- Do not test implementation details — test the observable contract of each function.

---

## Domain-Specific Guidance

### Scoring Data

- WGI caption eras are defined in `data/wgi_caption_eras.js` and `data/wgi_caption_eras_2021_patch.js`. These are the source of truth for scoring formulas.
- Always use year-based era lookup to determine scoring structure — never hardcode caption names.
- Cross-era comparison uses domain buckets (`music_effect`, `visual_effect`, `music_perf`, `visual_perf`).
- 2021 has no effect captions — domain buckets will have gaps.

### HTML Parsing

- Source HTML files are in `data/scores/<year>/`. These are CompetitionSuite recaps — **not served to clients**.
- Use `data-translate-number` attributes for score extraction (2019+). Fall back to `td.score` text content for 2015–2018.
- Use `header-division-name` class for class headers (2023+). Fall back to inline style matching for earlier years.
- Skip non-percussion divisions (e.g., "Winds Independent A").

### Data Files

There are **two data directories** — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full layout.

- `data/scores/<year>/` — source HTML recap files (input to the import tool, not served)
- `public/data/<year>/` — runtime JSON (import tool output, served as static assets)
  - Per-show JSON files: `public/data/<year>/<show-id>.json`
  - Season metadata: `public/data/<year>/season.json`
  - Ensemble registry: `public/data/ensembles.json`

The import CLI (`npx tsx src/import.ts`) reads from `data/scores/` and writes to `public/data/`.

---

## What Not to Do

- Do not add a backend, API routes, or server-side rendering. This is a static site.
- Do not add a second test framework — Vitest is the only test runner.
- Do not add `eslint` or `prettier` config files unless explicitly requested.
- Do not remove `StrictMode`.
- Do not use `any` to silence TypeScript errors — fix the type instead.
- Do not commit `dist/` — it is in `.gitignore` and built by Cloudflare Pages CI.
- Do not add `console.log` statements to committed code.
- **Never run `grep`, `cat`, `find`, `sed`, `awk`, or chained pipes in Bash.** Use the dedicated tools instead: `Grep` to search file contents, `Read` to read files, `Glob` to find files by pattern. Reserve Bash exclusively for operations that require shell execution (`git`, `gh`, `npm`, system commands).
- Do not push directly to `main` — always use a feature branch and open a pull request.
