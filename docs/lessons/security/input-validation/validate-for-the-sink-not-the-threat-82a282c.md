# Validate for the Sink, Not the Threat List

**Why it matters:** Any time you add input validation to the pipeline, the correct rule depends on where the value is *used*, not on a generic list of scary characters.

## The concept

Dangerous characters are only dangerous relative to an interpreter. A backtick means something to a shell, `../` means something to a path resolver, `<` means something to an HTML parser — and nothing to anything else. So the rule is derived from the sink: trace where the value actually flows, then reject what that specific sink would misread. Validating against a generic threat list instead produces two failures at once — it misses the sink you didn't think about, and it rejects legitimate data that merely looks alarming. The second failure is the expensive one, because false positives on valid input erode trust in the gate until people start overriding it.

## In this codebase

Issue #137 asked for shell-metacharacter rejection in `src/pipeline/validate.ts`. Tracing the sinks showed the premise was stale: `commit.ts` and `reportIssue.ts` had already moved to `execFileSync` with argument arrays (#130), so no shell ever parses these strings. Running the proposed pattern `` /[`$\;|&<>]/ `` over the 90 archived show files rejected a real one — the 2021 championships, on the ensemble `Bobby & Ben`.

The sink that *did* matter was never mentioned in the issue. `src/import.ts` builds the output path by interpolation:

```typescript
const showFileName = `${showData.metadata.id}.json`
const showFilePath = resolve(args.outputDir, showFileName)
```

`resolve()` happily walks out of `outputDir`, so an id of `../../../etc/passwd` escapes it. `validateStringContent` therefore constrains identifiers with `/^[A-Za-z0-9_-]+$/` — excluding `.` and slashes kills traversal — while leaving free-text names alone apart from a length cap and control characters, which corrupt commit messages and issue bodies regardless of any interpreter.

## Key takeaway

Follow the value to its sink before writing the regex: the characters worth rejecting are the ones the destination will interpret, and everything else you block is just a false positive waiting to page you.
