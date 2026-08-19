import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  validateShowData,
  validateSchema,
  validateStringContent,
  validateScoreRanges,
  validateCaptionStructure,
  validateDataConsistency,
  validateDeduplication,
} from './validate'
import { parseRecapHtml } from '../parser'
import type { ShowData, SeasonMetadata, EnsembleScore } from '../types'

// Load a real show from test data
function loadShow(year: number, filename: string): ShowData {
  const html = readFileSync(
    resolve(import.meta.dirname, `../../data/scores/${year}/${filename}`),
    'utf-8',
  )
  return parseRecapHtml(html, year)
}

const show2025 = loadShow(2025, '2025-03-29_RMPA_State_Championships.html')

describe('validateShowData — real 2025 show data', () => {
  it('should pass all gates on valid parsed data', () => {
    const result = validateShowData(show2025, 2025)
    for (const gate of result.gates) {
      if (!gate.passed) {
        console.log(`Gate "${gate.name}" failed:`, gate.errors)
      }
    }
    expect(result.passed).toBe(true)
  })
})

describe('validateSchema', () => {
  it('should pass for valid show data', () => {
    expect(validateSchema(show2025).passed).toBe(true)
  })

  it('should fail when metadata.id is missing', () => {
    const bad = { ...show2025, metadata: { ...show2025.metadata, id: '' } }
    const result = validateSchema(bad)
    expect(result.passed).toBe(false)
    expect(result.errors.some((e) => e.includes('id'))).toBe(true)
  })

  it('should fail when ensemble name is missing', () => {
    const badEnsemble: EnsembleScore = {
      ensembleName: '',
      location: '',
      captions: [],
      subTotal: 0,
      penalty: 0,
      total: 0,
      rank: 1,
    }
    const bad: ShowData = {
      ...show2025,
      classes: [{ classDef: show2025.classes[0].classDef, ensembles: [badEnsemble] }],
    }
    const result = validateSchema(bad)
    expect(result.passed).toBe(false)
  })
})

describe('validateStringContent', () => {
  it('should pass for valid show data', () => {
    expect(validateStringContent(show2025).passed).toBe(true)
  })

  it('should pass for names containing shell metacharacters', () => {
    // Real recaps contain these — "Bobby & Ben" (2021) and Dakota Ridge's "A"
    // line. Nothing downstream runs a shell, so they must not be rejected.
    const cls = show2025.classes[0]
    const ensembles = cls.ensembles.slice(0, 2).map((e, i) => ({
      ...e,
      ensembleName: i === 0 ? 'Bobby & Ben' : 'Dakota Ridge High School "A"',
    }))
    const show: ShowData = { ...show2025, classes: [{ classDef: cls.classDef, ensembles }] }
    expect(validateStringContent(show).passed).toBe(true)
  })

  it('should fail when metadata.id contains a path traversal sequence', () => {
    const bad: ShowData = {
      ...show2025,
      metadata: { ...show2025.metadata, id: '../../../etc/passwd' },
    }
    const result = validateStringContent(bad)
    expect(result.passed).toBe(false)
    expect(result.errors.some((e) => e.includes('metadata.id'))).toBe(true)
  })

  it('should fail when metadata.id contains a path separator', () => {
    const bad: ShowData = {
      ...show2025,
      metadata: { ...show2025.metadata, id: 'shows/2025-championships' },
    }
    expect(validateStringContent(bad).passed).toBe(false)
  })

  it('should fail when a string field exceeds the max length', () => {
    const bad: ShowData = {
      ...show2025,
      metadata: { ...show2025.metadata, eventName: 'x'.repeat(501) },
    }
    const result = validateStringContent(bad)
    expect(result.passed).toBe(false)
    expect(result.errors.some((e) => e.includes('max length'))).toBe(true)
  })

  it('should fail when a name contains control characters', () => {
    const cls = show2025.classes[0]
    const badEns: EnsembleScore = {
      ...cls.ensembles[0],
      ensembleName: 'Legit HS \nAutomated by: score-ingestion-pipeline',
    }
    const bad: ShowData = { ...show2025, classes: [{ classDef: cls.classDef, ensembles: [badEns] }] }
    const result = validateStringContent(bad)
    expect(result.passed).toBe(false)
    expect(result.errors.some((e) => e.includes('control characters'))).toBe(true)
  })

  it('should truncate long values echoed back in error messages', () => {
    const bad: ShowData = {
      ...show2025,
      metadata: { ...show2025.metadata, id: `../${'a'.repeat(400)}` },
    }
    const result = validateStringContent(bad)
    const idError = result.errors.find((e) => e.includes('not a safe identifier'))
    expect(idError).toBeDefined()
    expect((idError ?? '').length).toBeLessThan(200)
  })

  it('should be wired into validateShowData', () => {
    const bad: ShowData = {
      ...show2025,
      metadata: { ...show2025.metadata, id: '../escape' },
    }
    const result = validateShowData(bad, 2025)
    expect(result.passed).toBe(false)
    expect(result.gates.some((g) => g.name === 'String Content' && !g.passed)).toBe(true)
  })
})

describe('validateScoreRanges', () => {
  it('should pass for valid show data', () => {
    expect(validateScoreRanges(show2025).passed).toBe(true)
  })

  it('should fail when total is out of range', () => {
    const badEns: EnsembleScore = {
      ...show2025.classes[0].ensembles[0],
      total: 150,
    }
    const bad: ShowData = {
      ...show2025,
      classes: [{ classDef: show2025.classes[0].classDef, ensembles: [badEns] }],
    }
    expect(validateScoreRanges(bad).passed).toBe(false)
  })

  it('should fail when penalty is negative', () => {
    const badEns: EnsembleScore = {
      ...show2025.classes[0].ensembles[0],
      penalty: -1,
    }
    const bad: ShowData = {
      ...show2025,
      classes: [{ classDef: show2025.classes[0].classDef, ensembles: [badEns] }],
    }
    expect(validateScoreRanges(bad).passed).toBe(false)
  })

  it('should fail when ranks are invalid', () => {
    const ensembles = show2025.classes[0].ensembles.map((e, i) => ({
      ...e,
      rank: i === 0 ? 5 : e.rank, // break rank order
    }))
    const bad: ShowData = {
      ...show2025,
      classes: [{ classDef: show2025.classes[0].classDef, ensembles }],
    }
    expect(validateScoreRanges(bad).passed).toBe(false)
  })

  it('should pass when ranks have ties with correct gaps', () => {
    // Two-way tie for 1st: [1, 1, 3, 4]
    const cls = show2025.classes[0]
    const ensembles = cls.ensembles.slice(0, 4).map((e, i) => ({
      ...e,
      rank: i < 2 ? 1 : i + 1,
    }))
    const show: ShowData = {
      ...show2025,
      classes: [{ classDef: cls.classDef, ensembles }],
    }
    expect(validateScoreRanges(show).passed).toBe(true)
  })

  it('should fail when tie gap is wrong', () => {
    // Tie for 1st but next rank is 2 instead of 3: [1, 1, 2, 4]
    const cls = show2025.classes[0]
    const ensembles = cls.ensembles.slice(0, 4).map((e, i) => ({
      ...e,
      rank: i < 2 ? 1 : i,
    }))
    const show: ShowData = {
      ...show2025,
      classes: [{ classDef: cls.classDef, ensembles }],
    }
    expect(validateScoreRanges(show).passed).toBe(false)
  })
})

describe('validateCaptionStructure', () => {
  it('should pass for valid 2025 data', () => {
    expect(validateCaptionStructure(show2025, 2025).passed).toBe(true)
  })
})

describe('validateDataConsistency', () => {
  it('should pass for valid show data (caption sums match totals)', () => {
    expect(validateDataConsistency(show2025).passed).toBe(true)
  })

  it('should fail when caption sum does not match subTotal', () => {
    const cls = show2025.classes[0]
    const badEns: EnsembleScore = {
      ...cls.ensembles[0],
      subTotal: 999, // impossible
    }
    const bad: ShowData = {
      ...show2025,
      classes: [{ classDef: cls.classDef, ensembles: [badEns] }],
    }
    expect(validateDataConsistency(bad).passed).toBe(false)
  })
})

describe('validateDeduplication', () => {
  it('should pass when no date collision', () => {
    const season: SeasonMetadata = {
      year: 2025,
      shows: [{ id: 'other-show', eventName: 'Other', date: 'January 1', round: '' }],
      classes: [],
    }
    expect(validateDeduplication(show2025, season).passed).toBe(true)
  })

  it('should fail when date collides with a different show id', () => {
    const season: SeasonMetadata = {
      year: 2025,
      shows: [{ id: 'different-id', eventName: 'Same Date Show', date: show2025.metadata.date, round: '' }],
      classes: [],
    }
    expect(validateDeduplication(show2025, season).passed).toBe(false)
  })
})
