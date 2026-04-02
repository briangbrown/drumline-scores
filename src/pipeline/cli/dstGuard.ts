/**
 * DST Guard — exits 0 to proceed, exits 1 to skip.
 *
 * Each workflow has two cron entries (one for MST, one for MDT). This script
 * checks if the current UTC hour matches the correct entry for the current
 * DST state in America/Denver, preventing double runs at the DST boundary.
 *
 * Usage:
 *   npx tsx src/pipeline/cli/dstGuard.ts --mst-hour 21 --mdt-hour 20
 *   npx tsx src/pipeline/cli/dstGuard.ts --mst-hours 1-6 --mdt-hours 0-5
 */

function isDenverDST(now: Date): boolean {
  const offset = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Denver',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')
      ?.value?.replace('GMT', '') ?? '-7',
  )
  // MDT = UTC-6, MST = UTC-7
  return offset === -6
}

function parseHourRange(value: string): Array<number> {
  if (value.includes('-')) {
    const [start, end] = value.split('-').map(Number)
    const hours: Array<number> = []
    for (let h = start; h <= end; h++) hours.push(h)
    return hours
  }
  return [Number(value)]
}

function main(): void {
  const args = process.argv.slice(2)
  const now = new Date()
  const utcHour = now.getUTCHours()
  const isMDT = isDenverDST(now)

  let mstHours: Array<number> = []
  let mdtHours: Array<number> = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mst-hour' || args[i] === '--mst-hours') {
      mstHours = parseHourRange(args[i + 1])
    }
    if (args[i] === '--mdt-hour' || args[i] === '--mdt-hours') {
      mdtHours = parseHourRange(args[i + 1])
    }
  }

  if (mstHours.length === 0 || mdtHours.length === 0) {
    console.error('Usage: dstGuard.ts --mst-hour(s) <H|H-H> --mdt-hour(s) <H|H-H>')
    process.exit(1)
  }

  // If we're in MDT and this is an MST-only hour, skip
  if (isMDT && mstHours.includes(utcHour) && !mdtHours.includes(utcHour)) {
    console.log(`Skipping: UTC hour ${utcHour} is MST-only cron, but Denver is in MDT`)
    process.exit(1)
  }

  // If we're in MST and this is an MDT-only hour, skip
  if (!isMDT && mdtHours.includes(utcHour) && !mstHours.includes(utcHour)) {
    console.log(`Skipping: UTC hour ${utcHour} is MDT-only cron, but Denver is in MST`)
    process.exit(1)
  }

  const tzLabel = isMDT ? 'MDT' : 'MST'
  console.log(`Proceeding: UTC hour ${utcHour}, Denver is in ${tzLabel}`)
}

export { isDenverDST, parseHourRange }

// Only run when executed directly (not when imported by tests)
const isDirectRun = process.argv[1]?.endsWith('dstGuard.ts') ?? false
if (isDirectRun) {
  main()
}
