import { execFileSync } from 'node:child_process'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IssueFailure = {
  failureType: string
  eventName: string
  date: string
  sourceUrl: string | null
  gate: string | null
  errors: Array<string>
  suggestedAction: string
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

function formatIssueBody(failure: IssueFailure): string {
  const errorList = failure.errors.map((e) => `- ${e}`).join('\n')
  return `## What happened
${failure.failureType}

## Details
- **Event:** ${failure.eventName}
- **Date:** ${failure.date}
- **Source URL:** ${failure.sourceUrl ?? 'N/A'}
- **Failed gate:** ${failure.gate ?? 'N/A'}

## Errors
${errorList}

## Action needed
${failure.suggestedAction}

---
*Filed automatically by the score ingestion pipeline.*`
}

function reportFailure(failure: IssueFailure): void {
  const title = `[Score Pipeline] ${failure.failureType} — ${failure.eventName} (${failure.date})`
  const body = formatIssueBody(failure)
  const labels = ['score-pipeline']

  if (failure.gate === 'validation-failure') labels.push('validation-failure')
  if (failure.failureType.includes('not posted')) labels.push('missing-scores')
  if (failure.failureType.includes('ensemble')) labels.push('new-ensemble')

  const assignee = process.env['PIPELINE_ISSUE_ASSIGNEE'] ?? ''

  const args = [
    'issue', 'create',
    '--title', title,
    '--label', labels.join(','),
    '--body', body,
  ]
  if (assignee) args.push('--assignee', assignee)

  execFileSync('gh', args, { stdio: 'inherit' })
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { formatIssueBody, reportFailure }
export type { IssueFailure }
