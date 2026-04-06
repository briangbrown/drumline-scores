# Security Review — 2026-04-06

Comprehensive security review of the drumline-scores codebase covering source code,
CI/CD workflows, dependency management, and deployment configuration.

## Scope

- All TypeScript/JavaScript source files in `src/`
- All GitHub Actions workflows in `.github/workflows/`
- Python scripts in `scripts/`
- Static assets and HTML in `public/` and `index.html`
- Configuration files (tsconfig, vite, vitest, package.json)
- Data files and pipeline state

## Findings Summary

| # | Issue | Severity | Filed |
|---|-------|----------|-------|
| 1 | Command injection in pipeline shell commands | High | [#130](https://github.com/briangbrown/drumline-scores/issues/130) |
| 2 | API key prefix logged in generate_report.py | Medium | [#131](https://github.com/briangbrown/drumline-scores/issues/131) |
| 3 | Insufficient URL validation in scrapers | Medium | [#132](https://github.com/briangbrown/drumline-scores/issues/132) |
| 4 | Missing Content-Security-Policy header | Medium | [#133](https://github.com/briangbrown/drumline-scores/issues/133) |
| 5 | No npm audit in CI pipeline | Low-Medium | [#134](https://github.com/briangbrown/drumline-scores/issues/134) |
| 6 | --dangerously-skip-permissions in CI workflows | Medium | [#135](https://github.com/briangbrown/drumline-scores/issues/135) |
| 7 | Unsanitized Markdown in pipeline issue reports | Low-Medium | [#136](https://github.com/briangbrown/drumline-scores/issues/136) |
| 8 | Missing input content/length validation | Medium | [#137](https://github.com/briangbrown/drumline-scores/issues/137) |

## Positive Findings

The codebase demonstrates strong security practices in several areas:

- **Secret management**: All secrets use GitHub Actions secrets; no hardcoded credentials
- **TypeScript strict mode**: `strict: true` with additional flags prevents many bug classes
- **Service worker**: Same-origin-only request handling, proper offline fallback
- **Branch protection**: All changes require pull requests
- **Data validation**: 5-gate validation pipeline for imported scores
- **CODEOWNERS**: Workflow files restricted to designated reviewer
- **Test coverage**: 80% threshold enforced in CI

## Areas Not Requiring Action

- **Router (src/router.ts)**: Proper input validation with year range checks and `encodeURIComponent`
- **Data loading (src/data.ts)**: Same-origin relative fetches only, no SSRF risk
- **Favorites (src/favorites.ts)**: Safe localStorage usage with try-catch JSON parsing
- **Content hashing (src/pipeline/contentHash.ts)**: SHA-256 implementation is correct
- **Service worker (public/sw.js)**: Cache strategies are secure with origin checks

## Methodology

- Manual code review of all source files and workflows
- Analysis of data flow from external sources through pipeline to static output
- Review of secret handling across CI/CD and scripts
- Assessment of third-party dependency risk
