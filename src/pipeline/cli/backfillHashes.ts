/**
 * One-time script to backfill sourceHash into existing season.json files.
 *
 * For each year's HTML files in data/scores/<year>/, computes SHA-256 hashes
 * and matches them to the corresponding show entries in season.json by
 * extracting dates from both the filename and the show's date field.
 *
 * Usage: npx tsx src/pipeline/cli/backfillHashes.ts [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { hashContent } from '../contentHash'
import type { SeasonMetadata } from '../../types'

function extractDateFromFilename(filename: string): string | null {
  // "2025-02-08_Regular_Season_Show_1.html" → "2025-02-08"
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function extractDateFromShowDate(dateStr: string): string | null {
  // "Saturday, February 8, 2025" → "2025-02-08"
  const match = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/)
  if (!match) return null

  const months: Record<string, string> = {
    January: '01', February: '02', March: '03', April: '04',
    May: '05', June: '06', July: '07', August: '08',
    September: '09', October: '10', November: '11', December: '12',
  }
  const month = months[match[1]]
  if (!month) return null
  const day = match[2].padStart(2, '0')
  return `${match[3]}-${month}-${day}`
}

function main(): void {
  const isDryRun = process.argv.includes('--dry-run')
  const years = readdirSync('public/data')
    .filter((d) => /^\d{4}$/.test(d))
    .sort()

  let totalUpdated = 0

  for (const yearStr of years) {
    const seasonPath = resolve(`public/data/${yearStr}/season.json`)
    const htmlDir = resolve(`data/scores/${yearStr}`)

    if (!existsSync(seasonPath)) continue
    if (!existsSync(htmlDir)) {
      console.log(`${yearStr}: no HTML directory — skipping`)
      continue
    }

    const season = JSON.parse(readFileSync(seasonPath, 'utf-8')) as SeasonMetadata
    const htmlFiles = readdirSync(htmlDir).filter((f) => f.endsWith('.html'))

    // Build a date → HTML file map
    const htmlByDate = new Map<string, string>()
    for (const file of htmlFiles) {
      const date = extractDateFromFilename(file)
      if (date) {
        // If multiple files share a date (e.g. prelims + finals), use the last one
        htmlByDate.set(date, file)
      }
    }

    let yearUpdated = 0

    for (const show of season.shows) {
      // Skip if already has a hash
      if (show.sourceHash) continue

      const showDate = extractDateFromShowDate(show.date)
      if (!showDate) {
        console.log(`  ${yearStr}: could not parse date from "${show.date}" — skipping ${show.id}`)
        continue
      }

      const htmlFile = htmlByDate.get(showDate)
      if (!htmlFile) {
        console.log(`  ${yearStr}: no HTML file for date ${showDate} — skipping ${show.id}`)
        continue
      }

      const htmlPath = resolve(htmlDir, htmlFile)
      const html = readFileSync(htmlPath, 'utf-8')
      const hash = hashContent(html)

      show.sourceHash = hash
      show.lastImportedUtc = new Date().toISOString()
      yearUpdated++
    }

    if (yearUpdated > 0) {
      if (isDryRun) {
        console.log(`${yearStr}: would update ${yearUpdated} show(s) with sourceHash`)
      } else {
        writeFileSync(seasonPath, JSON.stringify(season, null, 2))
        console.log(`${yearStr}: updated ${yearUpdated} show(s) with sourceHash`)
      }
      totalUpdated += yearUpdated
    } else {
      console.log(`${yearStr}: all shows already have hashes or no matches found`)
    }
  }

  console.log(`\nTotal: ${totalUpdated} show(s) updated`)
}

const isDirectRun = process.argv[1]?.endsWith('backfillHashes.ts') ?? false
if (isDirectRun) {
  main()
}
