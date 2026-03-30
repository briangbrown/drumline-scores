/**
 * wgi_caption_eras_2021_patch.js
 *
 * Patch for wgi_caption_eras.js — adds the 2021 Virtual Season era.
 *
 * 2021 adopted the WGI Color Guard sub-caption framework temporarily:
 *   IMP = Impression  (subjective overall impact)
 *   AN  = Analysis    (technical/compositional evaluation)
 *   VAN = Visual Analysis Note  (AN variant used only by Visual judges in marching class)
 *
 * Sub-caption weighting: always equal (IMP = AN within each judge's sheet).
 *
 * Scoring mechanics differ from all other eras:
 *   - MORE judges per caption (4 music, 2 visual vs 1-2 in other eras)
 *   - Scores SUMMED across judges (not averaged)
 *   - Final = (Music sum + Visual sum) / 2   → out of 100
 *
 * 2021 preserved the Era 2 music/visual ratio: 60/40
 *   Music max = 4 × 30 = 120
 *   Visual max = 2 × 40 = 80
 *   Total max = 200 → divide by 2 = 100
 *
 * Sources: 2021 RMPA Championships Virtual (April 9, 2021)
 * Verified: Longmont PSA (91.675), Standley Lake PSA (77.70),
 *           Centaurus Standstill (94.375), Mountain Range Standstill (88.625)
 */

import { DOMAINS } from './wgi_caption_eras.js';

export const ERA_2021_VIRTUAL = {
  era: '2021v',
  label: '2021 Virtual Season',
  startYear: 2021,
  endYear: 2021,
  isVirtual: true,
  totalPoints: 100,           // final score is out of 100
  rawMax: 200,                // sum of all judges before dividing
  finalDivisor: 2,
  musicToVisualRatio: { music: 60, visual: 40 },  // same as Era 2

  notes: [
    'Sub-caption framework borrowed from WGI Color Guard: IMP (Impression) + AN (Analysis).',
    'Visual judges in marching class used VAN (Visual Analysis) instead of AN.',
    'Scores SUMMED across judges, then divided by 2 — not averaged per caption.',
    'Judge count significantly higher than normal eras (4 music, 2 visual).',
    '2020 season cancelled; 2022 returned to normal Era 2 structure.',
  ],

  // ── MARCHING CLASS (PSA, PSW, PIO, PIW, etc.) ───────────────────────────
  marchingCaptions: [
    {
      name: 'Music',
      domain: DOMAINS.MUSIC_PERF,
      judgeCount: 4,
      pointsPerJudge: 30,
      maxTotal: 120,          // 4 × 30
      pctOfFinal: 0.60,       // 120 / 200
      subCaptions: [
        { key: 'Imp', label: 'Impression', subPoints: 15, domain: DOMAINS.MUSIC_PERF },
        { key: 'AN',  label: 'Analysis',   subPoints: 15, domain: DOMAINS.MUSIC_PERF },
      ],
      // Per judge formula: (Imp/100 × 15) + (AN/100 × 15) = (Imp + AN) / 200 * 30
      // Then SUM all 4 judge scores (do not average)
      // Verified: Imp=96 AN=94 → 28.50; Imp=93 AN=88 → 27.15; etc.
      // Sum for Longmont = 28.50+27.15+28.05+27.45 = 111.15 ✓
    },
    {
      name: 'Visual',
      domain: DOMAINS.VISUAL_PERF,
      judgeCount: 2,
      pointsPerJudge: 40,
      maxTotal: 80,           // 2 × 40
      pctOfFinal: 0.40,       // 80 / 200
      subCaptions: [
        { key: 'Imp', label: 'Impression',       subPoints: 20, domain: DOMAINS.VISUAL_PERF },
        { key: 'VAN', label: 'Visual Analysis',  subPoints: 20, domain: DOMAINS.VISUAL_PERF },
      ],
      // Per judge formula: (Imp/100 × 20) + (VAN/100 × 20) = (Imp + VAN) / 200 * 40
      // Then SUM both judge scores
      // Verified: Imp=89 VAN=88 → 35.40; Imp=94 VAN=90 → 36.80 ✓
    },
  ],

  // ── STANDSTILL CLASS (SSA, SSW, etc.) ───────────────────────────────────
  // No separate Music/Visual split. 4 judges scoring the whole performance.
  standstillCaptions: [
    {
      name: 'Performance',    // No caption name shown in recap — single judging pool
      domain: null,           // Covers music_perf + music_effect (no visual element)
      domainSplit: {
        [DOMAINS.MUSIC_PERF]:   0.5,
        [DOMAINS.MUSIC_EFFECT]: 0.5,
      },
      judgeCount: 4,
      pointsPerJudge: 50,
      maxTotal: 200,          // 4 × 50
      finalDivisor: 2,
      subCaptions: [
        { key: 'IMP', label: 'Impression', subPoints: 25, domain: null },
        { key: 'AN',  label: 'Analysis',   subPoints: 25, domain: null },
      ],
      // Per judge: (IMP + AN) / 200 * 50
      // SUM all 4 judges → divide by 2 = final
      // Verified: [93,91,46.00] [95,93,47.00] [95,95,47.50] [97,96,48.25] sum=188.75/2=94.375 ✓
    },
  ],
};


// ── SCORING FUNCTIONS FOR 2021 ────────────────────────────────────────────

/**
 * Score a single judge's sheet in 2021 format.
 * @param {object} captionDef  - From ERA_2021_VIRTUAL.marchingCaptions or standstillCaptions
 * @param {object} subScores   - { Imp: number, AN: number }  or  { IMP: number, AN: number }
 * @returns {number}
 */
export function calc2021JudgeScore(captionDef, subScores) {
  return captionDef.subCaptions.reduce((sum, sub) => {
    const raw = subScores[sub.key];
    if (raw == null) throw new Error(`Missing "${sub.key}" in ${captionDef.name}`);
    return sum + (raw / 100) * sub.subPoints;
  }, 0);
}

/**
 * Compute final 2021 marching score from per-judge sub-caption arrays.
 * @param {number[][]} musicJudgeScores  - [[imp, an], [imp, an], ...] for each music judge
 * @param {number[][]} visualJudgeScores - [[imp, van], [imp, van]] for each visual judge
 * @returns {{ musicSum, visualSum, total }}
 */
export function calc2021MarchingTotal(musicJudgeScores, visualJudgeScores) {
  const mDef = ERA_2021_VIRTUAL.marchingCaptions[0]; // Music
  const vDef = ERA_2021_VIRTUAL.marchingCaptions[1]; // Visual

  const musicSum = musicJudgeScores.reduce((s, [imp, an]) =>
    s + calc2021JudgeScore(mDef, { Imp: imp, AN: an }), 0);

  const visualSum = visualJudgeScores.reduce((s, [imp, van]) =>
    s + calc2021JudgeScore(vDef, { Imp: imp, VAN: van }), 0);

  return {
    musicSum,
    visualSum,
    rawTotal: musicSum + visualSum,
    total: (musicSum + visualSum) / ERA_2021_VIRTUAL.finalDivisor,
  };
}

/**
 * Compute final 2021 standstill score.
 * @param {number[][]} judgeScores - [[imp, an], ...] for each judge
 * @returns {{ sum, total }}
 */
export function calc2021StandstillTotal(judgeScores) {
  const def = ERA_2021_VIRTUAL.standstillCaptions[0];
  const sum = judgeScores.reduce((s, [imp, an]) =>
    s + calc2021JudgeScore(def, { IMP: imp, AN: an }), 0);
  return { sum, total: sum / def.finalDivisor };
}


// ── PATCH: replace getMarchingEra in the main module ─────────────────────
// Import this alongside the main module and use this version instead.

import { MARCHING_ERAS as BASE_ERAS } from './wgi_caption_eras.js';

export function getMarchingEra(year) {
  if (year === 2021) return ERA_2021_VIRTUAL;
  return BASE_ERAS.find(e =>
    year >= e.startYear && (e.endYear === null || year <= e.endYear)
  );
}


// ── UPDATED CROSSWALK ENTRY ───────────────────────────────────────────────
export const CROSSWALK_2021 = {
  yearRange: '2021 (virtual only)',
  captions: {
    marching: [
      {
        name: 'Music (×4 judges)',
        maxPtsPerJudge: 30, totalMax: 120, pct: '60%',
        subPts: { Imp: 15, AN: 15 },
        scoring: 'SUM 4 judges; do NOT average',
      },
      {
        name: 'Visual (×2 judges)',
        maxPtsPerJudge: 40, totalMax: 80, pct: '40%',
        subPts: { Imp: 20, VAN: 20 },
        scoring: 'SUM 2 judges; do NOT average',
      },
    ],
    standstill: [
      {
        name: 'Performance (×4 judges)',
        maxPtsPerJudge: 50, totalMax: 200, pct: '100%',
        subPts: { IMP: 25, AN: 25 },
        scoring: 'SUM 4 judges ÷ 2 = final',
      },
    ],
  },
  normalizationNote:
    'For cross-year comparison, normalize each caption to its pct of max before mapping to domains. ' +
    'Music: musicSum/120 × 100 = music_perf%. Visual: visualSum/80 × 100 = visual_perf%. ' +
    'No effect captions exist in 2021 — GE/EM/EV have no equivalent. ' +
    'Map Music → music_perf and Visual → visual_perf only.',
};
