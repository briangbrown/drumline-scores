---
name: teach-lesson
description: Extract a key insight from a completed task and write a short teaching lesson. Use after finishing a non-trivial bug fix, feature, refactor, or investigation.
---

## Workflow

After completing non-trivial work (bug fix, feature, refactor, or investigation), extract one key insight — something you had to know or figure out — and teach it as a short, digestible lesson.

### 1. Decide whether a lesson is warranted

Write a lesson when the conversation involved:
- A non-obvious TypeScript, React, or Vite pattern you had to apply
- A math or algorithmic concept central to the fix
- A tricky architectural decision or tradeoff
- A subtle bug whose root cause is worth understanding
- A domain-specific insight about WGI scoring, percussion data, or CompetitionSuite parsing

**Skip it** for purely mechanical changes (typo fixes, renaming, trivial config tweaks).

### 2. Write the lesson

Keep it short — aim for under 30 lines. Use this structure:

```markdown
# <Lesson Title>

**Why it matters:** One sentence on when this knowledge applies.

## The concept

Two to four sentences explaining the core idea clearly.

## In this codebase

A concrete code snippet or reference to the specific file/function where this appeared.

## Key takeaway

One crisp sentence the reader should remember.
```

### 3. Save the lesson

Get the current short commit hash:

```bash
git rev-parse --short HEAD
```

Save to:

```
docs/lessons/<lesson-category>/<lesson-topic>/<lesson-name>-<short-hash>.md
```

- **`lesson-category`** — high-level grouping (e.g. `typescript`, `react`, `scoring`, `parsing`, `architecture`)
- **`lesson-topic`** — more specific subject within the category (e.g. `generics`, `hooks`, `wgi-eras`, `competitionsuite`)
- **`lesson-name`** — kebab-case name for the specific lesson (e.g. `cross-era-domain-normalization`)
- **`short-hash`** — first 7 characters of the current git commit hash

Reuse existing category and topic directories where they fit. Create new ones only when no existing grouping applies.

### 4. Surface the takeaway

After writing the lesson, briefly surface the key takeaway inline in the conversation so it is visible without opening the file.
