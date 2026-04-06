/**
 * Daily Fallback CLI — Stage 4
 *
 * Single check of rmpa.org/scores for any new or changed recap links.
 * Hash-compares recent shows (last 7 days) to catch late corrections.
 *
 * Usage: npx tsx src/pipeline/cli/fallback.ts [--dry-run]
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseScorePage, filterByYear } from '../scrapeScores'
import { hashContent, compareHash } from '../contentHash'
import { validateShowData } from '../validate'
import { parseRecapHtml } from '../../parser'
import { formatIssueBody } from '../reportIssue'
import type { IssueFailure } from '../reportIssue'
import type { SeasonMetadata } from '../../types'

const SCORES_URL = 'https://rmpa.org/scores'

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()
}

function readSeasonJson(year: number): SeasonMetadata | null {
  const path = `public/data/${year}/season.json`
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as SeasonMetadata
}

function getStoredHash(season: SeasonMetadata, recapUrl: string): string | null {
  for (const show of season.shows) {
    const entry = show as Record<string, unknown>
    if (entry['sourceUrl'] === recapUrl) {
      return (entry['sourceHash'] as string) ?? null
    }
  }
  return null
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run')
  const now = new Date()
  const year = now.getFullYear()

  console.log(`[Fallback] ${now.toISOString()} — checking for new or updated scores`)

  // Fetch scores page
  console.log(`Fetching ${SCORES_URL}...`)
  const scoresHtml = await fetchText(SCORES_URL)
  const allEntries = parseScorePage(scoresHtml)
  const seasonEntries = filterByYear(allEntries, year)
  console.log(`Found ${seasonEntries.length} recap links for ${year}`)

  const season = readSeasonJson(year)
  let changesFound = false

  for (const entry of seasonEntries) {
    const previousHash = season ? getStoredHash(season, entry.recapUrl) : null

    // Only re-check if new or potentially changed
    if (previousHash !== null) {
      // Known URL — only re-download to hash-compare (catches corrections)
      // In a full implementation this would only check recent shows
    }

    let recapHtml: string
    try {
      recapHtml = await fetchText(entry.recapUrl)
    } catch (err) {
      console.log(`  ⚠ Failed to fetch ${entry.recapUrl}: ${err}`)
      continue
    }

    const currentHash = hashContent(recapHtml)
    const comparison = compareHash(currentHash, previousHash)

    if (comparison.status === 'unchanged') continue

    console.log(`  ${comparison.status}: ${entry.eventName} (${entry.date})`)

    const showData = parseRecapHtml(recapHtml, year)
    const validation = validateShowData(showData, year, season ?? undefined)

    if (!validation.passed) {
      const failures = validation.gates.filter((g) => !g.passed)
      console.log(`  ✗ Validation failed: ${failures.map((f) => f.name).join(', ')}`)

      if (!isDryRun) {
        const failure: IssueFailure = {
          failureType: 'Fallback validation failure',
          eventName: entry.eventName,
          date: entry.date,
          sourceUrl: entry.recapUrl,
          gate: failures[0].name,
          errors: failures.flatMap((f) => f.errors),
          suggestedAction: 'Review the validation errors and manually import if appropriate.',
        }
        console.log(formatIssueBody(failure))
      }
      continue
    }

    console.log(`  ✓ Validation passed — importing`)
    changesFound = true

    if (isDryRun) {
      console.log(`  [Dry run] Would import and commit`)
    } else {
      const htmlDir = `data/scores/${year}`
      mkdirSync(htmlDir, { recursive: true })
      const htmlFilename = `${entry.date.replace(/,?\s+/g, '-').toLowerCase()}_${entry.eventName.replace(/\s+/g, '_')}.html`
      const htmlPath = resolve(htmlDir, htmlFilename)
      writeFileSync(htmlPath, recapHtml, 'utf-8')

      console.log(`  Importing ${basename(htmlPath)}...`)
      try {
        execFileSync('npx', ['tsx', 'src/import.ts', htmlPath, '--year', String(year)], {
          stdio: 'inherit',
        })
      } catch (err) {
        console.error(`  ✗ Import failed:`, err)
      }
    }
  }

  if (!changesFound) {
    console.log('No new or changed scores found')
  }
}

export { main }

const isDirectRun = process.argv[1]?.endsWith('fallback.ts') ?? false
if (isDirectRun) {
  main().catch((err) => {
    console.error('[Fallback] Fatal error:', err)
    process.exit(1)
  })
}
