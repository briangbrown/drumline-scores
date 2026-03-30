---
name: fix-bug
description: Fix a GitHub issue. Use when the user says "fix bug #N", "fix issue #N", or similar.
argument-hint: [issue-number]
---

## Context

!`gh issue view $ARGUMENTS --json title,body,comments,labels,assignees 2>/dev/null || echo "ERROR: Could not fetch issue $ARGUMENTS. Check the issue number and try again."`

---

## Workflow

Fix GitHub issue **#$ARGUMENTS** by following these steps strictly in order.

### 1. Understand the issue

Read the issue context above carefully. Identify:
- The expected behaviour vs actual behaviour
- Any reproduction steps or error messages
- Which files or components are likely involved

If the issue context shows an error, stop and tell the user the issue could not be loaded.

### 2. Create a branch

```bash
git checkout -b fix-bug-$ARGUMENTS
```

If the branch already exists, switch to it with `git checkout fix-bug-$ARGUMENTS`.

### 3. Locate the code

Search `src/` for the relevant components, types, and files mentioned in or implied by the issue. Read the code thoroughly before making changes.

### 4. Implement the fix

- Make the **minimal change** required to fix the issue.
- Follow the code style and architectural conventions in CLAUDE.md.
- Write or update tests for any modified pure functions.

### 5. Verify

Run:

```bash
npm test && npm run build
```

Both must pass with zero errors. If tests fail:
- Determine whether the failure is related to your change or pre-existing.
- Fix any failures caused by your change before proceeding.
- Do **not** skip or delete failing tests.

### 6. Stage and commit

```bash
git add .
```

Write a concise commit message in the format: `fix: <what was fixed> (#$ARGUMENTS)`

### 7. Push and open a PR

```bash
git push -u origin fix-bug-$ARGUMENTS
```

Then create a PR:

```bash
gh pr create \
  --title "Fix: <Issue Title>" \
  --body "Closes #$ARGUMENTS.

## What changed
<1-3 bullet points describing the fix>

## How it was verified
- All tests pass
- Build succeeds
<any additional verification>" \
  --base main
```

Return the PR URL when done.
