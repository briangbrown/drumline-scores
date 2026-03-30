import { describe, it, expect } from 'vitest'
import {
  MARCHING_ERAS,
  CONCERT_SCHEMA,
  ERA_2021_VIRTUAL,
  calcCaptionScore,
  avgJudgeScores,
  getMarchingEra,
  findCaption,
  normalizeToPct,
  scoresByDomain,
  calc2021JudgeScore,
  calc2021MarchingTotal,
  calc2021StandstillTotal,
} from './scoring'
import { DOMAINS } from './types'

// Test vectors verified against real RMPA recap data
const TEST_VECTORS = [
  // 2015 Era 1 — General Effect
  { year: 2015, captionName: 'General Effect', subs: { Mus: 88, Ovr: 88 }, expect: 35.2 },
  { year: 2015, captionName: 'General Effect', subs: { Mus: 89, Ovr: 91 }, expect: 36.0 },
  // 2015 Era 1 — Music
  { year: 2015, captionName: 'Music', subs: { Comp: 91, Perf: 92 }, expect: 36.65 },
  { year: 2015, captionName: 'Music', subs: { Comp: 90, Perf: 88 }, expect: 35.5 },
  // 2015 Era 1 — Visual
  { year: 2015, captionName: 'Visual', subs: { Comp: 97, Perf: 97 }, expect: 19.4 },
  { year: 2015, captionName: 'Visual', subs: { Comp: 94, Perf: 93 }, expect: 18.7 },
  // 2016 Era 2 — Music
  { year: 2016, captionName: 'Music', subs: { Comp: 90, Perf: 88 }, expect: 26.6 },
  { year: 2016, captionName: 'Music', subs: { Comp: 85, Perf: 84 }, expect: 25.3 },
  // 2016 Era 2 — Effect–Music
  { year: 2016, captionName: 'Effect – Music', subs: { Ovr: 91, Mus: 89 }, expect: 27.0 },
  { year: 2016, captionName: 'Effect – Music', subs: { Ovr: 87, Mus: 87 }, expect: 26.1 },
  // 2016 Era 2 — Effect–Visual
  { year: 2016, captionName: 'Effect – Visual', subs: { Ovr: 90, Vis: 90 }, expect: 18.0 },
  { year: 2016, captionName: 'Effect – Visual', subs: { Ovr: 88, Vis: 88 }, expect: 17.6 },
] as const

describe('calcCaptionScore', () => {
  for (const vec of TEST_VECTORS) {
    it(`should compute ${vec.captionName} (${vec.year}) = ${vec.expect}`, () => {
      const era = getMarchingEra(vec.year)
      expect(era).toBeDefined()
      if (!era || !('captions' in era)) return
      const def = findCaption(era, vec.captionName)
      expect(def).toBeDefined()
      if (!def) return
      const result = calcCaptionScore(def, vec.subs as Record<string, number>)
      expect(result).toBeCloseTo(vec.expect, 2)
    })
  }

  it('should throw when a sub-caption key is missing', () => {
    const era = getMarchingEra(2016)
    if (!era || !('captions' in era)) return
    const def = findCaption(era, 'Music')
    if (!def) return
    expect(() => calcCaptionScore(def, { Comp: 90 })).toThrow('Missing sub-caption')
  })
})

describe('calcCaptionScore — concert', () => {
  it('should compute Music caption (concert)', () => {
    const def = findCaption(CONCERT_SCHEMA, 'Music')
    expect(def).toBeDefined()
    if (!def) return
    // Comp=89 Perf=90 → (89/100*20)+(90/100*30) = 17.80+27.00 = 44.80
    expect(calcCaptionScore(def, { Comp: 89, Perf: 90 })).toBeCloseTo(44.8, 2)
  })

  it('should compute Artistry caption (concert)', () => {
    const def = findCaption(CONCERT_SCHEMA, 'Artistry')
    expect(def).toBeDefined()
    if (!def) return
    // Prog=92 Ful=92 → (92/100*20)+(92/100*30) = 18.40+27.60 = 46.00
    expect(calcCaptionScore(def, { Prog: 92, Ful: 92 })).toBeCloseTo(46.0, 2)
  })
})

describe('avgJudgeScores', () => {
  it('should average two judge scores', () => {
    expect(avgJudgeScores([36.0, 35.2])).toBeCloseTo(35.6, 2)
  })

  it('should return 0 for empty array', () => {
    expect(avgJudgeScores([])).toBe(0)
  })

  it('should return single score for single judge', () => {
    expect(avgJudgeScores([27.0])).toBeCloseTo(27.0, 2)
  })
})

describe('getMarchingEra', () => {
  it('should return Era 1 for 2015', () => {
    const era = getMarchingEra(2015)
    expect(era).toBeDefined()
    if (era && 'era' in era) expect(era.era).toBe(1)
  })

  it('should return Era 2 for 2016', () => {
    const era = getMarchingEra(2016)
    expect(era).toBeDefined()
    if (era && 'era' in era) expect(era.era).toBe(2)
  })

  it('should return Era 2 for 2025', () => {
    const era = getMarchingEra(2025)
    expect(era).toBeDefined()
    if (era && 'era' in era) expect(era.era).toBe(2)
  })

  it('should return 2021 virtual era for 2021', () => {
    const era = getMarchingEra(2021)
    expect(era).toBeDefined()
    if (era) expect(era.era).toBe('2021v')
  })

  it('should return undefined for years before 1993', () => {
    expect(getMarchingEra(1990)).toBeUndefined()
  })
})

describe('findCaption', () => {
  it('should find by exact name', () => {
    const era = MARCHING_ERAS[1] // Era 2
    expect(findCaption(era, 'Effect – Music')?.name).toBe('Effect – Music')
  })

  it('should find by alias', () => {
    const era = MARCHING_ERAS[0] // Era 1
    expect(findCaption(era, 'GE')?.name).toBe('General Effect')
    expect(findCaption(era, 'PA')?.name).toBe('Music')
  })

  it('should return undefined for unknown caption', () => {
    const era = MARCHING_ERAS[1]
    expect(findCaption(era, 'Nonexistent')).toBeUndefined()
  })
})

describe('normalizeToPct', () => {
  it('should normalize to percentage', () => {
    expect(normalizeToPct(27.0, 30)).toBeCloseTo(90.0, 2)
    expect(normalizeToPct(18.0, 20)).toBeCloseTo(90.0, 2)
    expect(normalizeToPct(36.0, 40)).toBeCloseTo(90.0, 2)
  })
})

describe('scoresByDomain', () => {
  it('should bucket Era 2 scores into domains', () => {
    const scores = [
      { captionName: 'Effect – Music', score: 27.0 },
      { captionName: 'Effect – Visual', score: 18.0 },
      { captionName: 'Music', score: 26.6 },
      { captionName: 'Visual', score: 17.5 },
    ]
    const result = scoresByDomain(scores, 2025)
    expect(result[DOMAINS.MUSIC_EFFECT]).toBeCloseTo(90.0, 1)
    expect(result[DOMAINS.VISUAL_EFFECT]).toBeCloseTo(90.0, 1)
    expect(result[DOMAINS.MUSIC_PERF]).toBeCloseTo(88.67, 1)
    expect(result[DOMAINS.VISUAL_PERF]).toBeCloseTo(87.5, 1)
  })

  it('should split Era 1 GE across music_effect and visual_effect', () => {
    const scores = [
      { captionName: 'General Effect', score: 36.0 },
      { captionName: 'Music', score: 35.5 },
      { captionName: 'Visual', score: 18.7 },
    ]
    const result = scoresByDomain(scores, 2015)
    // GE 36/40 = 90% → 45 each bucket
    expect(result[DOMAINS.MUSIC_EFFECT]).toBeCloseTo(45.0, 1)
    expect(result[DOMAINS.VISUAL_EFFECT]).toBeCloseTo(45.0, 1)
    expect(result[DOMAINS.MUSIC_PERF]).toBeCloseTo(88.75, 1)
    expect(result[DOMAINS.VISUAL_PERF]).toBeCloseTo(93.5, 1)
  })

  it('should return empty object for unknown year', () => {
    const result = scoresByDomain([{ captionName: 'Music', score: 27 }], 1990)
    expect(result).toEqual({})
  })
})

describe('calc2021JudgeScore', () => {
  it('should compute a music judge score', () => {
    const mDef = ERA_2021_VIRTUAL.marchingCaptions[0]
    // Imp=96 AN=94 → (96/100*15)+(94/100*15) = 14.40+14.10 = 28.50
    expect(calc2021JudgeScore(mDef, { Imp: 96, AN: 94 })).toBeCloseTo(28.5, 2)
  })

  it('should compute a visual judge score', () => {
    const vDef = ERA_2021_VIRTUAL.marchingCaptions[1]
    // Imp=89 VAN=88 → (89/100*20)+(88/100*20) = 17.80+17.60 = 35.40
    expect(calc2021JudgeScore(vDef, { Imp: 89, VAN: 88 })).toBeCloseTo(35.4, 2)
  })
})

describe('calc2021MarchingTotal', () => {
  it('should compute Longmont PSA total (91.675)', () => {
    // Music judges: [96,94], [93,88], [95,92], [93,90]
    // Visual judges: [89,88], [94,90]
    const result = calc2021MarchingTotal(
      [[96, 94], [93, 88], [95, 92], [93, 90]],
      [[89, 88], [94, 90]],
    )
    // musicSum = 28.50+27.15+28.05+27.45 = 111.15
    expect(result.musicSum).toBeCloseTo(111.15, 2)
    // visualSum = 35.40+36.80 = 72.20
    expect(result.visualSum).toBeCloseTo(72.2, 2)
    // total = (111.15+72.20)/2 = 91.675
    expect(result.total).toBeCloseTo(91.675, 3)
  })
})

describe('calc2021StandstillTotal', () => {
  it('should compute Centaurus standstill total (94.375)', () => {
    // [93,91], [95,93], [95,95], [97,96]
    const result = calc2021StandstillTotal(
      [[93, 91], [95, 93], [95, 95], [97, 96]],
    )
    // Judge scores: 46.00, 47.00, 47.50, 48.25 → sum=188.75
    expect(result.sum).toBeCloseTo(188.75, 2)
    // total = 188.75/2 = 94.375
    expect(result.total).toBeCloseTo(94.375, 3)
  })
})
