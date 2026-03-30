/**
 * Import CLI tool — parse CompetitionSuite HTML recaps into structured JSON.
 *
 * Usage:
 *   npx tsx src/import.ts <html-file> [--year 2025] [--output data/2025/] [--dry-run]
 *
 * This is a Node CLI script, not bundled in the client.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { parseRecapHtml, getClassAbbreviation } from './parser'
import { matchEnsemble, createEnsembleEntry, addAlias, normalizeLocation } from './ensemble-registry'
import type { EnsembleRegistry, SeasonMetadata, ClassDef, SeasonShow } from './types'

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

type CliArgs = {
  htmlFile: string
  year: number
  outputDir: string
  dryRun: boolean
  registryPath: string
}

function parseArgs(args: Array<string>): CliArgs {
  const positional: Array<string> = []
  let year: number | null = null
  let outputDir: string | null = null
  let dryRun = false
  let registryPath = 'public/data/ensembles.json'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--year' && i + 1 < args.length) {
      year = parseInt(args[++i], 10)
    } else if (arg === '--output' && i + 1 < args.length) {
      outputDir = args[++i]
    } else if (arg === '--registry' && i + 1 < args.length) {
      registryPath = args[++i]
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (!arg.startsWith('--')) {
      positional.push(arg)
    }
  }

  if (positional.length === 0) {
    console.error('Usage: npx tsx src/import.ts <html-file> [--year 2025] [--output public/data/2025/] [--dry-run]')
    process.exit(1)
  }

  const htmlFile = positional[0]

  // Infer year from filename if not provided
  if (!year) {
    const yearMatch = basename(htmlFile).match(/\b(20\d{2})\b/)
    year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear()
  }

  if (!outputDir) {
    outputDir = `public/data/${year}`
  }

  return { htmlFile, year, outputDir, dryRun, registryPath }
}

// ---------------------------------------------------------------------------
// Main import logic
// ---------------------------------------------------------------------------

function loadRegistry(path: string): EnsembleRegistry {
  if (existsSync(path)) {
    const data = readFileSync(path, 'utf-8')
    return JSON.parse(data) as EnsembleRegistry
  }
  return { ensembles: [] }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const htmlPath = resolve(args.htmlFile)

  console.log(`Importing: ${htmlPath}`)
  console.log(`Year: ${args.year}`)
  console.log(`Output: ${args.outputDir}`)
  if (args.dryRun) console.log('DRY RUN — no files will be written')

  // Read and parse HTML
  const html = readFileSync(htmlPath, 'utf-8')
  const showData = parseRecapHtml(html, args.year)

  console.log(`\nParsed: ${showData.metadata.eventName}`)
  console.log(`  Date: ${showData.metadata.date}`)
  console.log(`  Round: ${showData.metadata.round}`)
  console.log(`  Classes: ${showData.classes.length}`)

  for (const cls of showData.classes) {
    console.log(`  - ${cls.classDef.name} (${getClassAbbreviation(cls.classDef.name)}): ${cls.ensembles.length} ensembles`)
  }

  // Load or create ensemble registry
  const registryPath = resolve(args.registryPath)
  const registry = loadRegistry(registryPath)
  const unknownEnsembles: Array<{ name: string; location: string }> = []

  // Match ensembles against registry
  for (const cls of showData.classes) {
    for (const ensemble of cls.ensembles) {
      const result = matchEnsemble(registry, ensemble.ensembleName, ensemble.location)

      if (result.confidence === 'unknown') {
        // Add new ensemble to registry
        const entry = createEnsembleEntry(ensemble.ensembleName, ensemble.location)
        registry.ensembles.push(entry)
        unknownEnsembles.push({ name: ensemble.ensembleName, location: ensemble.location })
      } else if (result.entry && result.confidence === 'fuzzy') {
        // Add as alias if fuzzy matched
        addAlias(result.entry, ensemble.ensembleName)
        // Update location if missing
        if (!result.entry.city && ensemble.location) {
          const normalized = normalizeLocation(ensemble.location)
          const parts = normalized.split(',').map((p) => p.trim())
          result.entry.city = parts[0] ?? ''
          result.entry.state = parts[1] ?? ''
        }
      }
    }
  }

  if (unknownEnsembles.length > 0) {
    console.log(`\n⚠ New ensembles added to registry (${unknownEnsembles.length}):`)
    for (const ue of unknownEnsembles) {
      console.log(`  + ${ue.name} (${ue.location || 'no location'})`)
    }
  }

  // Write output files
  if (!args.dryRun) {
    // Create output directory
    mkdirSync(resolve(args.outputDir), { recursive: true })

    // Write per-show JSON
    const showFileName = `${showData.metadata.id}.json`
    const showFilePath = resolve(args.outputDir, showFileName)
    writeFileSync(showFilePath, JSON.stringify(showData, null, 2))
    console.log(`\nWrote: ${showFilePath}`)

    // Update or create season.json
    const seasonPath = resolve(args.outputDir, 'season.json')
    const season = loadOrCreateSeason(seasonPath, args.year)
    updateSeason(season, showData.metadata, showData.classes.map((c) => c.classDef))
    writeFileSync(seasonPath, JSON.stringify(season, null, 2))
    console.log(`Wrote: ${seasonPath}`)

    // Write updated registry
    // Sort ensembles by canonical name for stability
    registry.ensembles.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName))
    writeFileSync(registryPath, JSON.stringify(registry, null, 2))
    console.log(`Wrote: ${registryPath}`)
  }

  console.log('\nDone!')
}

function loadOrCreateSeason(path: string, year: number): SeasonMetadata {
  if (existsSync(path)) {
    const data = readFileSync(path, 'utf-8')
    return JSON.parse(data) as SeasonMetadata
  }
  return { year, shows: [], classes: [] }
}

function updateSeason(
  season: SeasonMetadata,
  metadata: { id: string; eventName: string; date: string; round: string },
  classDefs: Array<ClassDef>,
): void {
  // Add or update show entry
  const existingShow = season.shows.find((s) => s.id === metadata.id)
  const showEntry: SeasonShow = {
    id: metadata.id,
    eventName: metadata.eventName,
    date: metadata.date,
    round: metadata.round,
  }

  if (existingShow) {
    Object.assign(existingShow, showEntry)
  } else {
    season.shows.push(showEntry)
  }

  // Merge class definitions (add any new classes)
  for (const cls of classDefs) {
    if (!season.classes.find((c) => c.id === cls.id)) {
      season.classes.push(cls)
    }
  }

  // Sort shows by date (parse the human-readable date for correct ordering)
  season.shows.sort((a, b) => {
    const da = new Date(a.date).getTime()
    const db = new Date(b.date).getTime()
    if (!isNaN(da) && !isNaN(db)) return da - db
    return a.date.localeCompare(b.date)
  })
}

// Run
main()
