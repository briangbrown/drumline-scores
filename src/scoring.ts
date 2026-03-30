import type {
  CaptionDef,
  CaptionDef2021,
  ConcertSchema,
  Domain,
  DomainScores,
  Era2021Virtual,
  MarchingEra,
  SubCaptionDef,
} from './types'
import { DOMAINS } from './types'

// ---------------------------------------------------------------------------
// MARCHING ERAS
// ---------------------------------------------------------------------------

export const MARCHING_ERAS: Array<MarchingEra> = [
  {
    era: 1,
    label: 'Original 3-caption',
    startYear: 1993,
    endYear: 2015,
    totalPoints: 100,
    musicToVisualRatio: { music: 80, visual: 20 },
    notes: [
      'Caption "Performance Analysis" renamed to "Music" sometime in the 2000s.',
      'GE sub-captions Mus+Ovr cover what Era 2 splits into EM and EV.',
      'RMPA ran double panels on GE and Music at Championships level.',
    ],
    captions: [
      {
        name: 'General Effect',
        nameAliases: ['GE'],
        domain: null,
        domainSplit: {
          [DOMAINS.MUSIC_EFFECT]: 0.5,
          [DOMAINS.VISUAL_EFFECT]: 0.5,
        },
        maxPoints: 40,
        pctOfTotal: 0.4,
        subCaptions: [
          { key: 'Mus', label: 'Music Effect', subPoints: 20, domain: DOMAINS.MUSIC_EFFECT },
          { key: 'Ovr', label: 'Overall Effect', subPoints: 20, domain: DOMAINS.MUSIC_EFFECT },
        ],
        judgeCount: { regional: 1, championship: 2 },
      },
      {
        name: 'Music',
        nameAliases: ['Performance Analysis', 'PA', 'M'],
        domain: DOMAINS.MUSIC_PERF,
        maxPoints: 40,
        pctOfTotal: 0.4,
        subCaptions: [
          { key: 'Comp', label: 'Composition', subPoints: 15, domain: DOMAINS.MUSIC_PERF },
          { key: 'Perf', label: 'Performance Quality', subPoints: 25, domain: DOMAINS.MUSIC_PERF },
        ],
        judgeCount: { regional: 1, championship: 2 },
      },
      {
        name: 'Visual',
        nameAliases: ['V'],
        domain: DOMAINS.VISUAL_PERF,
        maxPoints: 20,
        pctOfTotal: 0.2,
        subCaptions: [
          { key: 'Comp', label: 'Composition', subPoints: 10, domain: DOMAINS.VISUAL_PERF },
          { key: 'Perf', label: 'Performance Quality', subPoints: 10, domain: DOMAINS.VISUAL_PERF },
        ],
        judgeCount: { regional: 1, championship: 2 },
      },
    ],
  },
  {
    era: 2,
    label: 'Current 4-caption',
    startYear: 2016,
    endYear: null,
    totalPoints: 100,
    musicToVisualRatio: { music: 60, visual: 40 },
    notes: [
      'Effect – Visual added in 2016.',
      'Music sub-caption weighting preserved Perf:Comp ratio from Era 1.',
    ],
    captions: [
      {
        name: 'Effect – Music',
        nameAliases: ['Effect Music', 'EM', 'Eff Music', 'Eff Mus'],
        domain: DOMAINS.MUSIC_EFFECT,
        maxPoints: 30,
        pctOfTotal: 0.3,
        subCaptions: [
          { key: 'Ovr', label: 'Overall Effect', subPoints: 15, domain: DOMAINS.MUSIC_EFFECT },
          { key: 'Mus', label: 'Music Effect', subPoints: 15, domain: DOMAINS.MUSIC_EFFECT },
        ],
        judgeCount: { regional: 1, championship: 2 },
      },
      {
        name: 'Effect – Visual',
        nameAliases: ['Effect Visual', 'EV', 'Eff Visual', 'Eff Vis'],
        domain: DOMAINS.VISUAL_EFFECT,
        maxPoints: 20,
        pctOfTotal: 0.2,
        subCaptions: [
          { key: 'Ovr', label: 'Overall Effect', subPoints: 10, domain: DOMAINS.VISUAL_EFFECT },
          { key: 'Vis', label: 'Visual Effect', subPoints: 10, domain: DOMAINS.VISUAL_EFFECT },
        ],
        judgeCount: { regional: 1, championship: 2 },
      },
      {
        name: 'Music',
        nameAliases: ['M'],
        domain: DOMAINS.MUSIC_PERF,
        maxPoints: 30,
        pctOfTotal: 0.3,
        subCaptions: [
          { key: 'Comp', label: 'Composition', subPoints: 10, domain: DOMAINS.MUSIC_PERF },
          { key: 'Perf', label: 'Performance Quality', subPoints: 20, domain: DOMAINS.MUSIC_PERF },
        ],
        judgeCount: { regional: 1, championship: 2 },
      },
      {
        name: 'Visual',
        nameAliases: ['V'],
        domain: DOMAINS.VISUAL_PERF,
        maxPoints: 20,
        pctOfTotal: 0.2,
        subCaptions: [
          { key: 'Comp', label: 'Composition', subPoints: 10, domain: DOMAINS.VISUAL_PERF },
          { key: 'Perf', label: 'Performance Quality', subPoints: 10, domain: DOMAINS.VISUAL_PERF },
        ],
        judgeCount: { regional: 1, championship: 2 },
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// 2021 VIRTUAL ERA
// ---------------------------------------------------------------------------

export const ERA_2021_VIRTUAL: Era2021Virtual = {
  era: '2021v',
  label: '2021 Virtual Season',
  startYear: 2021,
  endYear: 2021,
  isVirtual: true,
  totalPoints: 100,
  rawMax: 200,
  finalDivisor: 2,
  musicToVisualRatio: { music: 60, visual: 40 },
  notes: [
    'Sub-caption framework borrowed from WGI Color Guard: IMP + AN.',
    'Visual judges in marching class used VAN instead of AN.',
    'Scores SUMMED across judges, then divided by 2.',
  ],
  marchingCaptions: [
    {
      name: 'Music',
      domain: DOMAINS.MUSIC_PERF,
      judgeCount: 4,
      pointsPerJudge: 30,
      maxTotal: 120,
      pctOfFinal: 0.6,
      subCaptions: [
        { key: 'Imp', label: 'Impression', subPoints: 15, domain: DOMAINS.MUSIC_PERF },
        { key: 'AN', label: 'Analysis', subPoints: 15, domain: DOMAINS.MUSIC_PERF },
      ],
    },
    {
      name: 'Visual',
      domain: DOMAINS.VISUAL_PERF,
      judgeCount: 2,
      pointsPerJudge: 40,
      maxTotal: 80,
      pctOfFinal: 0.4,
      subCaptions: [
        { key: 'Imp', label: 'Impression', subPoints: 20, domain: DOMAINS.VISUAL_PERF },
        { key: 'VAN', label: 'Visual Analysis', subPoints: 20, domain: DOMAINS.VISUAL_PERF },
      ],
    },
  ],
  standstillCaptions: [
    {
      name: 'Performance',
      domain: null,
      domainSplit: {
        [DOMAINS.MUSIC_PERF]: 0.5,
        [DOMAINS.MUSIC_EFFECT]: 0.5,
      },
      judgeCount: 4,
      pointsPerJudge: 50,
      maxTotal: 200,
      finalDivisor: 2,
      subCaptions: [
        { key: 'IMP', label: 'Impression', subPoints: 25, domain: null },
        { key: 'AN', label: 'Analysis', subPoints: 25, domain: null },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// CONCERT SCHEMA (all years)
// ---------------------------------------------------------------------------

export const CONCERT_SCHEMA: ConcertSchema = {
  label: 'Concert — all years',
  startYear: 1993,
  endYear: null,
  totalPoints: 100,
  notes: [
    'Scholastic-only classes (SCW, SCO, SCA). Standstill — no Visual caption.',
    'Both captions use Perf(Ful)-heavy weighting.',
  ],
  captions: [
    {
      name: 'Music',
      nameAliases: ['M'],
      domain: DOMAINS.MUSIC_PERF,
      maxPoints: 50,
      pctOfTotal: 0.5,
      subCaptions: [
        { key: 'Comp', label: 'Composition', subPoints: 20, domain: DOMAINS.MUSIC_PERF },
        { key: 'Perf', label: 'Performance Quality', subPoints: 30, domain: DOMAINS.MUSIC_PERF },
      ],
      judgeCount: { regional: 1, championship: 2 },
    },
    {
      name: 'Artistry',
      nameAliases: ['Art', 'A'],
      domain: DOMAINS.MUSIC_EFFECT,
      maxPoints: 50,
      pctOfTotal: 0.5,
      subCaptions: [
        { key: 'Prog', label: 'Program', subPoints: 20, domain: DOMAINS.MUSIC_EFFECT },
        { key: 'Ful', label: 'Fulfillment', subPoints: 30, domain: DOMAINS.MUSIC_EFFECT },
      ],
      judgeCount: { regional: 1, championship: 2 },
    },
  ],
}

// ---------------------------------------------------------------------------
// SCORING FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Score a single judge's caption from raw sub-caption values.
 * Formula: caption_score = Σ (sub_score / 100 × sub_point_value)
 */
export function calcCaptionScore(
  captionDef: { subCaptions: Array<SubCaptionDef> },
  subScores: Record<string, number>,
): number {
  return captionDef.subCaptions.reduce((sum, sub) => {
    const raw = subScores[sub.key]
    if (raw == null) throw new Error(`Missing sub-caption "${sub.key}"`)
    return sum + (raw / 100) * sub.subPoints
  }, 0)
}

/**
 * Average multiple judges' caption scores (double panel).
 */
export function avgJudgeScores(judgeScores: Array<number>): number {
  if (judgeScores.length === 0) return 0
  return judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length
}

/**
 * Get the marching era definition for a given year.
 * Returns the 2021 virtual era for year 2021.
 */
export function getMarchingEra(year: number): MarchingEra | Era2021Virtual | undefined {
  if (year === 2021) return ERA_2021_VIRTUAL
  return MARCHING_ERAS.find(
    (e) => year >= e.startYear && (e.endYear === null || year <= e.endYear),
  )
}

/**
 * Find a caption definition by name (handles aliases).
 */
export function findCaption(
  era: { captions: Array<CaptionDef> },
  name: string,
): CaptionDef | undefined {
  return era.captions.find(
    (c) => c.name === name || c.nameAliases.includes(name),
  )
}

/**
 * Normalize a caption score to 0-100 percentage of its maximum.
 */
export function normalizeToPct(score: number, maxPoints: number): number {
  return (score / maxPoints) * 100
}

/**
 * Build domain-bucketed scores for cross-year comparison.
 * Era 1 GE is split 50/50 across music_effect and visual_effect.
 */
export function scoresByDomain(
  captionScores: Array<{ captionName: string; score: number }>,
  year: number,
): DomainScores {
  const era = getMarchingEra(year)
  if (!era) return {}

  const buckets: Record<string, number | null> = {
    [DOMAINS.MUSIC_EFFECT]: null,
    [DOMAINS.VISUAL_EFFECT]: null,
    [DOMAINS.MUSIC_PERF]: null,
    [DOMAINS.VISUAL_PERF]: null,
  }

  // 2021 has no standard captions array
  if ('captions' in era) {
    for (const { captionName, score } of captionScores) {
      const def = findCaption(era, captionName)
      if (!def) continue
      const pct = normalizeToPct(score, def.maxPoints)

      if (def.domainSplit) {
        for (const [domain, weight] of Object.entries(def.domainSplit)) {
          buckets[domain] = (buckets[domain] ?? 0) + pct * weight
        }
      } else if (def.domain) {
        buckets[def.domain] = pct
      }
    }
  }

  const result: DomainScores = {}
  for (const [key, value] of Object.entries(buckets)) {
    if (value !== null) {
      result[key as Domain] = value
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// 2021 SCORING FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Score a single judge's sheet in 2021 format.
 */
export function calc2021JudgeScore(
  captionDef: CaptionDef2021,
  subScores: Record<string, number>,
): number {
  return captionDef.subCaptions.reduce((sum, sub) => {
    const raw = subScores[sub.key]
    if (raw == null) throw new Error(`Missing "${sub.key}" in ${captionDef.name}`)
    return sum + (raw / 100) * sub.subPoints
  }, 0)
}

/**
 * Compute final 2021 marching score from per-judge sub-caption arrays.
 */
export function calc2021MarchingTotal(
  musicJudgeScores: Array<[number, number]>,
  visualJudgeScores: Array<[number, number]>,
): { musicSum: number; visualSum: number; rawTotal: number; total: number } {
  const mDef = ERA_2021_VIRTUAL.marchingCaptions[0]
  const vDef = ERA_2021_VIRTUAL.marchingCaptions[1]

  const musicSum = musicJudgeScores.reduce(
    (s, [imp, an]) => s + calc2021JudgeScore(mDef, { Imp: imp, AN: an }),
    0,
  )

  const visualSum = visualJudgeScores.reduce(
    (s, [imp, van]) => s + calc2021JudgeScore(vDef, { Imp: imp, VAN: van }),
    0,
  )

  return {
    musicSum,
    visualSum,
    rawTotal: musicSum + visualSum,
    total: (musicSum + visualSum) / ERA_2021_VIRTUAL.finalDivisor,
  }
}

/**
 * Compute final 2021 standstill score.
 */
export function calc2021StandstillTotal(
  judgeScores: Array<[number, number]>,
): { sum: number; total: number } {
  const def = ERA_2021_VIRTUAL.standstillCaptions[0]
  const sum = judgeScores.reduce(
    (s, [imp, an]) => s + calc2021JudgeScore(def, { IMP: imp, AN: an }),
    0,
  )
  return { sum, total: sum / (def.finalDivisor ?? 1) }
}
