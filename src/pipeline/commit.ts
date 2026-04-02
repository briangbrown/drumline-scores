import { execSync } from 'node:child_process'
import type { ShowData } from '../types'

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

function git(command: string): string {
  return execSync(`git ${command}`, { encoding: 'utf-8' }).trim()
}

function commitNewShow(showData: ShowData, files: Array<string>): void {
  const { metadata } = showData
  const classCount = showData.classes.length
  const ensembleCount = showData.classes.reduce((sum, c) => sum + c.ensembles.length, 0)
  const classNames = showData.classes.map((c) => c.classDef.name).join(', ')

  for (const file of files) {
    git(`add "${file}"`)
  }

  const message = [
    `chore(data): add scores for ${metadata.eventName} (${metadata.date})`,
    '',
    `Classes: ${classNames}`,
    `Ensembles: ${ensembleCount} ensembles across ${classCount} classes`,
    '',
    'Automated by: score-ingestion-pipeline',
  ].join('\n')

  git(`commit -m "${message.replace(/"/g, '\\"')}"`)
}

function commitUpdatedShow(
  showData: ShowData,
  files: Array<string>,
  reason: string,
  oldHash: string,
  newHash: string,
): void {
  const { metadata } = showData

  for (const file of files) {
    git(`add "${file}"`)
  }

  const message = [
    `chore(data): update scores for ${metadata.eventName} (${metadata.date})`,
    '',
    `Reason: ${reason}`,
    `Hash: ${oldHash.slice(0, 8)} → ${newHash.slice(0, 8)}`,
    '',
    'Automated by: score-ingestion-pipeline',
  ].join('\n')

  git(`commit -m "${message.replace(/"/g, '\\"')}"`)
}

function commitPollState(message: string): void {
  git('add public/data/poll-state.json')
  git(`commit -m "chore(data): ${message}\n\nAutomated by: score-ingestion-pipeline"`)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { commitNewShow, commitUpdatedShow, commitPollState }
