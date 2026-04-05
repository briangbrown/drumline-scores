import type { ShowData, SeasonMetadata } from '../types'
import { getMarchingEra, CONCERT_SCHEMA } from '../scoring'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GateResult = {
  name: string
  passed: boolean
  errors: Array<string>
  warnings: Array<string>
}

type ValidationResult = {
  passed: boolean
  gates: Array<GateResult>
}

// ---------------------------------------------------------------------------
// Gate 1: Schema Validation
// ---------------------------------------------------------------------------

function validateSchema(showData: ShowData): GateResult {
  const errors: Array<string> = []
  const { metadata, classes } = showData

  if (!metadata.id) errors.push('metadata.id is missing')
  if (!metadata.eventName) errors.push('metadata.eventName is missing')
  if (!metadata.date) errors.push('metadata.date is missing')
  if (typeof metadata.year !== 'number') errors.push('metadata.year is not a number')
  if (!Array.isArray(classes)) errors.push('classes is not an array')

  for (const cls of classes) {
    if (!cls.classDef?.id) errors.push(`class missing classDef.id`)
    if (!cls.classDef?.name) errors.push(`class missing classDef.name`)
    if (!Array.isArray(cls.ensembles)) errors.push(`class ${cls.classDef?.name} ensembles is not an array`)

    for (const ens of cls.ensembles) {
      if (!ens.ensembleName) errors.push('ensemble missing ensembleName')
      if (typeof ens.total !== 'number') errors.push(`${ens.ensembleName}: total is not a number`)
      if (typeof ens.rank !== 'number') errors.push(`${ens.ensembleName}: rank is not a number`)
    }
  }

  return { name: 'Schema Validation', passed: errors.length === 0, errors, warnings: [] }
}

// ---------------------------------------------------------------------------
// Gate 2: Score Range Checks
// ---------------------------------------------------------------------------

function validateScoreRanges(showData: ShowData): GateResult {
  const errors: Array<string> = []

  for (const cls of showData.classes) {
    for (const ens of cls.ensembles) {
      if (isNaN(ens.total)) errors.push(`${ens.ensembleName}: total is NaN`)
      if (ens.total < 0 || ens.total > 100) errors.push(`${ens.ensembleName}: total ${ens.total} out of range 0-100`)
      if (ens.penalty < 0) errors.push(`${ens.ensembleName}: penalty ${ens.penalty} is negative`)
      if (ens.rank < 1) errors.push(`${ens.ensembleName}: rank ${ens.rank} is less than 1`)

      for (const cap of ens.captions) {
        if (isNaN(cap.captionTotal)) errors.push(`${ens.ensembleName}/${cap.captionName}: captionTotal is NaN`)
        if (cap.captionTotal < 0) errors.push(`${ens.ensembleName}/${cap.captionName}: captionTotal ${cap.captionTotal} is negative`)

        for (const judge of cap.judges) {
          for (const sub of judge.subCaptions) {
            if (isNaN(sub.rawScore)) errors.push(`${ens.ensembleName}/${cap.captionName}/${judge.judgeName}: rawScore is NaN`)
            if (sub.rawScore < 0 || sub.rawScore > 100) {
              errors.push(`${ens.ensembleName}/${cap.captionName}/${judge.judgeName}/${sub.key}: rawScore ${sub.rawScore} out of range 0-100`)
            }
          }
        }
      }
    }

    // Check ranks follow competition tie rules:
    // Tied ensembles share the same rank, and the next rank skips ahead
    // e.g. [1, 1, 3, 4] is valid (two-way tie for 1st, next is 3rd)
    const ranks = cls.ensembles.map((e) => e.rank).sort((a, b) => a - b)
    if (ranks.length > 0 && ranks[0] !== 1) {
      errors.push(`${cls.classDef.name}: first rank should be 1, got ${ranks[0]}`)
    }
    const lastRank = ranks[ranks.length - 1]
    if (ranks.length > 0 && lastRank !== undefined && lastRank > ranks.length) {
      errors.push(`${cls.classDef.name}: highest rank ${lastRank} exceeds ensemble count ${ranks.length}`)
    }
    for (let i = 1; i < ranks.length; i++) {
      const prev = ranks[i - 1]
      const curr = ranks[i]
      if (prev === undefined || curr === undefined) continue
      // Each rank must be equal to the previous (tie) or greater
      if (curr < prev) {
        errors.push(`${cls.classDef.name}: rank ${curr} appears after ${prev} — out of order`)
        break
      }
      // A non-tied rank must equal its 1-based position (i + 1)
      if (curr !== prev && curr !== i + 1) {
        errors.push(`${cls.classDef.name}: rank ${curr} at position ${i + 1} — tie gap mismatch`)
        break
      }
    }
  }

  return { name: 'Score Range Checks', passed: errors.length === 0, errors, warnings: [] }
}

// ---------------------------------------------------------------------------
// Gate 3: Caption Structure
// ---------------------------------------------------------------------------

function validateCaptionStructure(showData: ShowData, year: number): GateResult {
  const errors: Array<string> = []

  for (const cls of showData.classes) {
    const classType = cls.classDef.classType
    if (cls.ensembles.length === 0) continue

    const firstEnsemble = cls.ensembles[0]
    const captionCount = firstEnsemble.captions.length

    if (classType === 'concert' || classType === 'standstill') {
      if (captionCount !== CONCERT_SCHEMA.captions.length) {
        errors.push(`${cls.classDef.name}: expected ${CONCERT_SCHEMA.captions.length} captions for ${classType}, got ${captionCount}`)
      }
    } else {
      // marching
      const era = getMarchingEra(year)
      if (era) {
        const expectedCount = 'marchingCaptions' in era
          ? (era as { marchingCaptions: Array<unknown> }).marchingCaptions.length
          : era.captions.length
        if (captionCount !== expectedCount) {
          errors.push(`${cls.classDef.name}: expected ${expectedCount} captions for ${classType} (year ${year}), got ${captionCount}`)
        }
      }
    }
  }

  return { name: 'Caption Structure', passed: errors.length === 0, errors, warnings: [] }
}

// ---------------------------------------------------------------------------
// Gate 5: Change Detection & Deduplication
// ---------------------------------------------------------------------------

function validateDeduplication(showData: ShowData, season: SeasonMetadata): GateResult {
  const errors: Array<string> = []

  // Check for date + venue collision with existing shows
  const showDate = showData.metadata.date
  for (const existing of season.shows) {
    if (existing.date === showDate && existing.id !== showData.metadata.id) {
      errors.push(`Possible duplicate: show date "${showDate}" matches existing show "${existing.id}"`)
    }
  }

  return { name: 'Change Detection', passed: errors.length === 0, errors, warnings: [] }
}

// ---------------------------------------------------------------------------
// Gate 7: Data Consistency
// ---------------------------------------------------------------------------

function validateDataConsistency(showData: ShowData): GateResult {
  const errors: Array<string> = []
  const tolerance = 0.5 // allow rounding drift from CompetitionSuite's display precision

  for (const cls of showData.classes) {
    for (const ens of cls.ensembles) {
      // The parser may not always populate subTotal separately from total.
      // Use subTotal if available, otherwise derive from total + penalty.
      const effectiveSubTotal = ens.subTotal > 0 ? ens.subTotal : ens.total + ens.penalty

      // Caption totals should sum to the effective subTotal
      const captionSum = ens.captions.reduce((sum, c) => sum + c.captionTotal, 0)
      if (Math.abs(captionSum - effectiveSubTotal) > tolerance) {
        errors.push(`${ens.ensembleName}: caption sum ${captionSum.toFixed(3)} != subTotal ${effectiveSubTotal} (diff ${Math.abs(captionSum - effectiveSubTotal).toFixed(3)})`)
      }

      // effectiveSubTotal - penalty should equal total
      if (ens.subTotal > 0) {
        const expectedTotal = ens.subTotal - ens.penalty
        if (Math.abs(expectedTotal - ens.total) > tolerance) {
          errors.push(`${ens.ensembleName}: subTotal ${ens.subTotal} - penalty ${ens.penalty} = ${expectedTotal.toFixed(3)} != total ${ens.total}`)
        }
      }
    }
  }

  return { name: 'Data Consistency', passed: errors.length === 0, errors, warnings: [] }
}

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------

function validateShowData(showData: ShowData, year: number, season?: SeasonMetadata): ValidationResult {
  const gates: Array<GateResult> = [
    validateSchema(showData),
    validateScoreRanges(showData),
    validateCaptionStructure(showData, year),
    validateDataConsistency(showData),
  ]

  if (season) {
    gates.push(validateDeduplication(showData, season))
  }

  return {
    passed: gates.every((g) => g.passed),
    gates,
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  validateShowData,
  validateSchema,
  validateScoreRanges,
  validateCaptionStructure,
  validateDeduplication,
  validateDataConsistency,
}

export type { GateResult, ValidationResult }
