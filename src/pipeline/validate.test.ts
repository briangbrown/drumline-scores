import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  validateShowData,
  validateSchema,
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

  it('should fail when ranks are not sequential', () => {
    const ensembles = show2025.classes[0].ensembles.map((e, i) => ({
      ...e,
      rank: i === 0 ? 5 : e.rank, // break sequential order
    }))
    const bad: ShowData = {
      ...show2025,
      classes: [{ classDef: show2025.classes[0].classDef, ensembles }],
    }
    expect(validateScoreRanges(bad).passed).toBe(false)
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
