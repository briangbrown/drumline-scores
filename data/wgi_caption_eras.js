/**
 * wgi_caption_eras.js  —  v2 (formula-verified)
 *
 * WGI Percussion caption schema: marching + concert classes.
 * All sub-caption weighting formulas verified against real RMPA recap data:
 *   2014 RMPA Championships (Coors Events Center)
 *   2015 RMPA Championships (1st Bank Center)
 *   2016 RMPA Championships (USAFA)
 *
 * Key formula (universal):
 *   caption_score = Σ (sub_score / 100 * sub_point_value)
 *   where sub_point_value is the number of caption points that sub-caption is worth.
 *
 * When a caption has a double panel, each judge produces a caption_score independently,
 * then those are averaged.
 *
 * Era boundary confirmed at circuit level: 2015 = 3-caption, 2016 = 4-caption.
 * WGI nationals may have transitioned earlier (~2013), but RMPA data confirms 2016.
 */


// ---------------------------------------------------------------------------
// CANONICAL DOMAIN BUCKETS  (stable across all eras, use for cross-year comparison)
// ---------------------------------------------------------------------------
export const DOMAINS = {
  MUSIC_EFFECT:  'music_effect',   // Entertainment, impact from the musical program
  VISUAL_EFFECT: 'visual_effect',  // Entertainment, impact from the visual program
  MUSIC_PERF:    'music_perf',     // Musical performance quality + arrangement
  VISUAL_PERF:   'visual_perf',    // Visual performance quality + spatial composition
};


// ---------------------------------------------------------------------------
// SUB-CAPTION SCORING FORMULA
//
// Every sub-caption is scored 0-100 by the judge. The contribution to the
// caption total is: (raw_score / 100) * sub_point_value
//
// Sub-point values confirmed by exhaustive formula check:
//
//   ERA 1 MARCHING (1993-2015)
//   ┌─────────────────────┬──────┬──────────────────────────────┐
//   │ Caption (40 or 20)  │ Subs │ Point values                 │
//   ├─────────────────────┼──────┼──────────────────────────────┤
//   │ General Effect (40) │ Mus  │ 20 pts  (equal split)        │
//   │                     │ Ovr  │ 20 pts                       │
//   │ Music (40)          │ Comp │ 15 pts  (Performance > Comp) │
//   │                     │ Perf │ 25 pts                       │
//   │ Visual (20)         │ Comp │ 10 pts  (equal split)        │
//   │                     │ Perf │ 10 pts                       │
//   └─────────────────────┴──────┴──────────────────────────────┘
//
//   ERA 2 MARCHING (2016-present)
//   ┌────────────────────────┬──────┬──────────────────────────────┐
//   │ Caption (30 or 20)     │ Subs │ Point values                 │
//   ├────────────────────────┼──────┼──────────────────────────────┤
//   │ Effect – Music (30)    │ Ovr  │ 15 pts  (equal split)        │
//   │                        │ Mus  │ 15 pts                       │
//   │ Effect – Visual (20)   │ Ovr  │ 10 pts  (equal split)        │
//   │                        │ Vis  │ 10 pts                       │
//   │ Music (30)             │ Comp │ 10 pts  (Perf still > Comp)  │
//   │                        │ Perf │ 20 pts                       │
//   │ Visual (20)            │ Comp │ 10 pts  (equal split)        │
//   │                        │ Perf │ 10 pts                       │
//   └────────────────────────┴──────┴──────────────────────────────┘
//
//   CONCERT (all years — unchanged)
//   ┌─────────────────────┬──────┬──────────────────────────────┐
//   │ Caption (50 each)   │ Subs │ Point values                 │
//   ├─────────────────────┼──────┼──────────────────────────────┤
//   │ Music (50)          │ Comp │ 20 pts  (Perf > Comp, 3:2)   │
//   │                     │ Perf │ 30 pts                       │
//   │ Artistry (50)       │ Prog │ 20 pts                       │
//   │                     │ Ful  │ 30 pts                       │
//   └─────────────────────┴──────┴──────────────────────────────┘
//
// Note: The Perf > Comp weighting principle is universal across all caption
// types and eras. The absolute point values change, but the ratio is consistent.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// MARCHING CLASS CAPTION ERAS
// ---------------------------------------------------------------------------
export const MARCHING_ERAS = [

  {
    era: 1,
    label: 'Original 3-caption',
    startYear: 1993,
    endYear: 2015,   // Confirmed: RMPA 2015 still used this structure
    totalPoints: 100,
    musicToVisualRatio: { music: 80, visual: 20 }, // (GE+Music)=80, Visual=20

    notes: [
      'Caption "Performance Analysis" renamed to "Music" sometime in the 2000s.',
      'GE sub-captions Mus+Ovr cover what Era 2 splits into EM and EV.',
      'RMPA ran double panels on GE and Music at Championships level.',
      'WGI nationals may have moved to Era 2 as early as 2013; circuit level confirmed 2015.',
    ],

    captions: [
      {
        name: 'General Effect',
        nameAliases: ['GE'],
        // Spans both effect domains — no separate visual effect judge
        domain: null,
        domainSplit: {
          [DOMAINS.MUSIC_EFFECT]:  0.5,
          [DOMAINS.VISUAL_EFFECT]: 0.5,
        },
        maxPoints: 40,
        pctOfTotal: 0.40,
        subCaptions: [
          { key: 'Mus', label: 'Music Effect',   subPoints: 20, domain: DOMAINS.MUSIC_EFFECT },
          { key: 'Ovr', label: 'Overall Effect', subPoints: 20, domain: DOMAINS.MUSIC_EFFECT },
        ],
        judgeCount: { regional: 1, championship: 2 },
        // Verified formula examples:
        // Mus=89 Ovr=91 → (89/100*20)+(91/100*20) = 36.00 ✓
        // Mus=88 Ovr=88 → (88/100*20)+(88/100*20) = 35.20 ✓
      },
      {
        name: 'Music',
        nameAliases: ['Performance Analysis', 'PA', 'M'],
        domain: DOMAINS.MUSIC_PERF,
        maxPoints: 40,
        pctOfTotal: 0.40,
        subCaptions: [
          { key: 'Comp', label: 'Composition',          subPoints: 15, domain: DOMAINS.MUSIC_PERF },
          { key: 'Perf', label: 'Performance Quality',  subPoints: 25, domain: DOMAINS.MUSIC_PERF },
        ],
        judgeCount: { regional: 1, championship: 2 },
        // Verified formula examples:
        // Comp=91 Perf=92 → (91/100*15)+(92/100*25) = 36.65 ✓
        // Comp=90 Perf=87 → (90/100*15)+(87/100*25) = 35.25 ✓
        // Comp=84.5 Perf=81 → (84.5/100*15)+(81/100*25) = 32.925 ✓
      },
      {
        name: 'Visual',
        nameAliases: ['V'],
        domain: DOMAINS.VISUAL_PERF,
        maxPoints: 20,
        pctOfTotal: 0.20,
        subCaptions: [
          { key: 'Comp', label: 'Composition',          subPoints: 10, domain: DOMAINS.VISUAL_PERF },
          { key: 'Perf', label: 'Performance Quality',  subPoints: 10, domain: DOMAINS.VISUAL_PERF },
        ],
        judgeCount: { regional: 1, championship: 2 },
        // Verified: Comp=97 Perf=97 → 19.40 ✓  Comp=94 Perf=93 → 18.70 ✓
      },
    ],
  },

  {
    era: 2,
    label: 'Current 4-caption',
    startYear: 2016,  // Confirmed: RMPA 2016 first appearance of Effect-Visual
    endYear: null,
    totalPoints: 100,
    musicToVisualRatio: { music: 60, visual: 40 }, // (EM+M)=60, (EV+V)=40

    notes: [
      'Effect – Visual added in 2016 (confirmed by 2025 PAB proposals + 2016 RMPA data).',
      'Music sub-caption weighting preserved the Perf:Comp ratio from Era 1 (2:1 vs 5:3).',
      'Sub-caption order changed: Era 1 GE = Mus+Ovr; Era 2 EM = Ovr+Mus (Overall now first).',
      'RMPA 2016 ran double panels on all 4 captions at Championships level (9 judges total).',
    ],

    captions: [
      {
        name: 'Effect – Music',
        nameAliases: ['Effect Music', 'EM'],
        domain: DOMAINS.MUSIC_EFFECT,
        maxPoints: 30,
        pctOfTotal: 0.30,
        subCaptions: [
          { key: 'Ovr', label: 'Overall Effect', subPoints: 15, domain: DOMAINS.MUSIC_EFFECT },
          { key: 'Mus', label: 'Music Effect',   subPoints: 15, domain: DOMAINS.MUSIC_EFFECT },
        ],
        judgeCount: { regional: 1, championship: 2 },
        // Verified: Ovr=91 Mus=89 → 27.00 ✓  Ovr=87 Mus=87 → 26.10 ✓
      },
      {
        name: 'Effect – Visual',
        nameAliases: ['Effect Visual', 'EV'],
        domain: DOMAINS.VISUAL_EFFECT,
        maxPoints: 20,
        pctOfTotal: 0.20,
        subCaptions: [
          { key: 'Ovr', label: 'Overall Effect', subPoints: 10, domain: DOMAINS.VISUAL_EFFECT },
          { key: 'Vis', label: 'Visual Effect',  subPoints: 10, domain: DOMAINS.VISUAL_EFFECT },
        ],
        judgeCount: { regional: 1, championship: 2 },
        // Verified: Ovr=90 Vis=90 → 18.00 ✓  Ovr=88 Vis=88 → 17.60 ✓
      },
      {
        name: 'Music',
        nameAliases: ['M'],
        domain: DOMAINS.MUSIC_PERF,
        maxPoints: 30,
        pctOfTotal: 0.30,
        subCaptions: [
          { key: 'Comp', label: 'Composition',          subPoints: 10, domain: DOMAINS.MUSIC_PERF },
          { key: 'Perf', label: 'Performance Quality',  subPoints: 20, domain: DOMAINS.MUSIC_PERF },
        ],
        judgeCount: { regional: 1, championship: 2 },
        // Verified: Comp=90 Perf=88 → 26.60 ✓  Comp=85 Perf=84 → 25.30 ✓
      },
      {
        name: 'Visual',
        nameAliases: ['V'],
        domain: DOMAINS.VISUAL_PERF,
        maxPoints: 20,
        pctOfTotal: 0.20,
        subCaptions: [
          { key: 'Comp', label: 'Composition',          subPoints: 10, domain: DOMAINS.VISUAL_PERF },
          { key: 'Perf', label: 'Performance Quality',  subPoints: 10, domain: DOMAINS.VISUAL_PERF },
        ],
        judgeCount: { regional: 1, championship: 2 },
        // Verified: Comp=88 Perf=87 → 17.50 ✓
      },
    ],
  },
];


// ---------------------------------------------------------------------------
// CONCERT CLASS SCHEMA  (all years — formula confirmed 2015 and 2016)
// ---------------------------------------------------------------------------
export const CONCERT_SCHEMA = {
  label: 'Concert — all years',
  startYear: 1993,
  endYear: null,
  totalPoints: 100,

  notes: [
    'Scholastic-only classes (SCW, SCO, SCA). Standstill — no Visual caption.',
    'Both captions use Perf(Ful)-heavy weighting: first sub = 20pts, second sub = 30pts.',
    'Artistry functions as a GE-style sheet; has not been substantially updated in years (GEM 2023).',
  ],

  captions: [
    {
      name: 'Music',
      domain: DOMAINS.MUSIC_PERF,
      maxPoints: 50,
      pctOfTotal: 0.50,
      subCaptions: [
        { key: 'Comp', label: 'Composition',          subPoints: 20, domain: DOMAINS.MUSIC_PERF },
        { key: 'Perf', label: 'Performance Quality',  subPoints: 30, domain: DOMAINS.MUSIC_PERF },
      ],
      judgeCount: { regional: 1, championship: 2 },
      // Verified: Comp=89 Perf=90 → 44.80 ✓  Comp=91 Perf=90 → 45.20 ✓
      // Verified: Comp=90 Perf=92 → 45.60 ✓  Comp=96 Perf=96 → 48.00 ✓
    },
    {
      name: 'Artistry',
      domain: DOMAINS.MUSIC_EFFECT,
      maxPoints: 50,
      pctOfTotal: 0.50,
      subCaptions: [
        { key: 'Prog', label: 'Program',     subPoints: 20, domain: DOMAINS.MUSIC_EFFECT },
        { key: 'Ful',  label: 'Fulfillment', subPoints: 30, domain: DOMAINS.MUSIC_EFFECT },
      ],
      judgeCount: { regional: 1, championship: 2 },
      // Verified: Prog=92 Ful=92 → 46.00 ✓  Prog=91 Ful=87.5 → 44.45 ✓
      // Verified: Prog=92 Ful=90 → 45.40 ✓  Prog=89 Ful=88 → 44.20 ✓
    },
  ],
};


// ---------------------------------------------------------------------------
// SCORING FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Score a single judge's caption from raw sub-caption values.
 * Works for any era — uses subPoints from the caption definition.
 *
 * @param {object} captionDef - Caption definition from MARCHING_ERAS or CONCERT_SCHEMA
 * @param {object} subScores  - { [subKey]: rawScore }  e.g. { Comp: 90, Perf: 88 }
 * @returns {number} Caption score (in actual points, not percentage)
 */
export function calcCaptionScore(captionDef, subScores) {
  return captionDef.subCaptions.reduce((sum, sub) => {
    const raw = subScores[sub.key];
    if (raw == null) throw new Error(`Missing sub-caption "${sub.key}" in ${captionDef.name}`);
    return sum + (raw / 100) * sub.subPoints;
  }, 0);
}

/**
 * Average multiple judges' caption scores (double panel).
 * @param {number[]} judgeScores
 * @returns {number}
 */
export function avgJudgeScores(judgeScores) {
  return judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length;
}

/**
 * Get the marching era definition for a given year.
 * Uses caption names from actual recap data when available — don't rely solely on year
 * if parsing circuit-level data, since circuits may lag WGI nationals.
 *
 * @param {number} year
 * @returns {object}
 */
export function getMarchingEra(year) {
  return MARCHING_ERAS.find(e =>
    year >= e.startYear && (e.endYear === null || year <= e.endYear)
  );
}

/**
 * Find a caption definition by name (handles aliases).
 * @param {object} era  - From MARCHING_ERAS or CONCERT_SCHEMA
 * @param {string} name
 * @returns {object|undefined}
 */
export function findCaption(era, name) {
  const pool = era.captions ?? [];
  return pool.find(c =>
    c.name === name || (c.nameAliases ?? []).includes(name)
  );
}

/**
 * Normalize a caption score to 0-100 percentage of its maximum.
 * Use this for cross-era comparison (GE/40 vs EM/30 vs EV/20).
 *
 * @param {number} score
 * @param {number} maxPoints
 * @returns {number} 0-100
 */
export function normalizeToPct(score, maxPoints) {
  return (score / maxPoints) * 100;
}

/**
 * Build a domain-bucketed score map for cross-year comparison.
 * Era 1 GE is split 50/50 across music_effect and visual_effect domains.
 *
 * @param {Array<{ captionName: string, score: number }>} captionScores
 * @param {number} year
 * @returns {object} { music_effect, visual_effect, music_perf, visual_perf } — each 0-100
 */
export function scoresByDomain(captionScores, year) {
  const era = getMarchingEra(year);
  const buckets = {
    [DOMAINS.MUSIC_EFFECT]:  null,
    [DOMAINS.VISUAL_EFFECT]: null,
    [DOMAINS.MUSIC_PERF]:    null,
    [DOMAINS.VISUAL_PERF]:   null,
  };

  for (const { captionName, score } of captionScores) {
    const def = findCaption(era, captionName);
    if (!def) continue;
    const pct = normalizeToPct(score, def.maxPoints);

    if (def.domainSplit) {
      for (const [domain, weight] of Object.entries(def.domainSplit)) {
        buckets[domain] = (buckets[domain] ?? 0) + pct * weight;
      }
    } else {
      buckets[def.domain] = pct;
    }
  }

  return buckets;
}


// ---------------------------------------------------------------------------
// HUMAN-READABLE CROSSWALK  (for documentation / prompts)
// ---------------------------------------------------------------------------
export const CAPTION_CROSSWALK = {
  marching: [
    {
      yearRange: '1993–2015',
      captions: [
        { name: 'General Effect', maxPts: 40, pct: '40%', subPts: { Mus: 20, Ovr: 20 }, domains: ['music_effect','visual_effect (shared)'] },
        { name: 'Music',          maxPts: 40, pct: '40%', subPts: { Comp: 15, Perf: 25 }, domains: ['music_perf'] },
        { name: 'Visual',         maxPts: 20, pct: '20%', subPts: { Comp: 10, Perf: 10 }, domains: ['visual_perf'] },
      ],
      subCaptionNote: 'Music sub-captions: Perf:Comp = 5:3 ratio (25:15)',
    },
    {
      yearRange: '2016–present',
      captions: [
        { name: 'Effect – Music',  maxPts: 30, pct: '30%', subPts: { Ovr: 15, Mus: 15 }, domains: ['music_effect'] },
        { name: 'Effect – Visual', maxPts: 20, pct: '20%', subPts: { Ovr: 10, Vis: 10 }, domains: ['visual_effect'] },
        { name: 'Music',           maxPts: 30, pct: '30%', subPts: { Comp: 10, Perf: 20 }, domains: ['music_perf'] },
        { name: 'Visual',          maxPts: 20, pct: '20%', subPts: { Comp: 10, Perf: 10 }, domains: ['visual_perf'] },
      ],
      subCaptionNote: 'Music sub-captions: Perf:Comp = 2:1 ratio (20:10). Effect captions equal-split.',
    },
  ],
  concert: [
    {
      yearRange: '1993–present',
      captions: [
        { name: 'Music',    maxPts: 50, pct: '50%', subPts: { Comp: 20, Perf: 30 }, domains: ['music_perf'] },
        { name: 'Artistry', maxPts: 50, pct: '50%', subPts: { Prog: 20, Ful:  30 }, domains: ['music_effect'] },
      ],
      subCaptionNote: 'Both captions: second sub (Perf/Ful) always 30pts, first sub (Comp/Prog) always 20pts.',
    },
  ],
};


// ---------------------------------------------------------------------------
// TEST VECTORS  (run to verify formula implementation)
// ---------------------------------------------------------------------------
export const TEST_VECTORS = [
  // 2015 RMPA Marching PSA — Longmont, General Effect
  { year: 2015, captionName: 'General Effect', judge: 'J.Allison',    subs: { Mus: 88, Ovr: 88 }, expect: 35.20 },
  { year: 2015, captionName: 'General Effect', judge: 'R.Ulibarri',   subs: { Mus: 89, Ovr: 91 }, expect: 36.00 },
  // 2015 RMPA Marching PSA — Longmont, Music
  { year: 2015, captionName: 'Music', judge: 'S.Johnson',    subs: { Comp: 91, Perf: 92 }, expect: 36.65 },
  { year: 2015, captionName: 'Music', judge: 'O.Carmenates', subs: { Comp: 90, Perf: 88 }, expect: 35.50 },
  // 2015 RMPA Marching PSA — Longmont, Visual
  { year: 2015, captionName: 'Visual', judge: 'J.Dwyer',  subs: { Comp: 97, Perf: 97 }, expect: 19.40 },
  { year: 2015, captionName: 'Visual', judge: 'F.Miller', subs: { Comp: 94, Perf: 93 }, expect: 18.70 },
  // 2016 RMPA Marching PSA — Longmont, Music (era 2)
  { year: 2016, captionName: 'Music', judge: 'J.Pipitone', subs: { Comp: 90, Perf: 88 }, expect: 26.60 },
  { year: 2016, captionName: 'Music', judge: 'J.Merritt',  subs: { Comp: 85, Perf: 84 }, expect: 25.30 },
  // 2016 RMPA Marching PSA — Longmont, Effect-Music
  { year: 2016, captionName: 'Effect – Music', judge: 'R.Ulibarri', subs: { Ovr: 91, Mus: 89 }, expect: 27.00 },
  { year: 2016, captionName: 'Effect – Music', judge: 'C.Heiny',    subs: { Ovr: 87, Mus: 87 }, expect: 26.10 },
  // 2016 RMPA Marching PSA — Longmont, Effect-Visual
  { year: 2016, captionName: 'Effect – Visual', judge: 'C.Craig',  subs: { Ovr: 90, Vis: 90 }, expect: 18.00 },
  { year: 2016, captionName: 'Effect – Visual', judge: 'J.Howell', subs: { Ovr: 88, Vis: 88 }, expect: 17.60 },
];
