---
name: create-feature
description: Implement a GitHub feature issue. Use when the user says "create feature #N", "implement feature #N", "build feature #N", or similar.
argument-hint: [issue-number]
---

## Context

!`gh issue view $ARGUMENTS --json title,body,comments,labels,assignees 2>/dev/null || echo "ERROR: Could not fetch issue $ARGUMENTS. Check the issue number and try again."`

---

## Workflow

Implement GitHub feature **#$ARGUMENTS** by following these steps strictly in order.

### 1. Understand the issue

Read the issue context above carefully. Identify the feature requirements, acceptance criteria, and any constraints.

If the issue context shows an error, stop and tell the user the issue could not be loaded.

### 2. Create a branch

```bash
git checkout -b create-feature-$ARGUMENTS
```

If the branch already exists, switch to it with `git checkout create-feature-$ARGUMENTS`.

### 3. Plan the feature

Before writing any code:

- **Ask clarifying questions** — resolve ambiguity about scope, edge cases, and requirements.
- **Suggest improvements** — propose UX enhancements, performance wins, better defaults, or anything that makes the feature more useful. Get approval before including them.
- **Save the plan** once scope is agreed:

```
docs/plans/features/<feature-name>-<NNNN>.md
```

where `<NNNN>` is the issue number zero-padded to 4 digits.

### 4. Locate the code

Search `src/` for the relevant components, types, and files. Read the code thoroughly before making changes.

### 5. Implement the feature

- Follow the code style and architectural conventions in CLAUDE.md.
- Write tests for any new pure functions.

### 6. Verify

Run:

```bash
npm test && npm run build
```

Both must pass with zero errors. If tests fail:
- Determine whether the failure is related to your change or pre-existing.
- Fix any failures caused by your change before proceeding.
- Do **not** skip or delete failing tests.

### 7. Stage and commit

```bash
git add .
```

Write a concise commit message in the format: `feat: <what was added> (#$ARGUMENTS)`

### 8. Push and open a PR

```bash
git push -u origin create-feature-$ARGUMENTS
```

Then create a PR:

```bash
gh pr create \
  --title "Feature: <Issue Title>" \
  --body "Closes #$ARGUMENTS.

## What changed
<bullet points describing the feature>

## How it was verified
- All tests pass
- Build succeeds
<any additional verification>" \
  --base main
```

Return the PR URL when done.
