// ---------------------------------------------------------------------------
// Domain buckets — stable across all eras, used for cross-year comparison
// ---------------------------------------------------------------------------

export const DOMAINS = {
  MUSIC_EFFECT: 'music_effect',
  VISUAL_EFFECT: 'visual_effect',
  MUSIC_PERF: 'music_perf',
  VISUAL_PERF: 'visual_perf',
} as const

export type Domain = (typeof DOMAINS)[keyof typeof DOMAINS]

// ---------------------------------------------------------------------------
// Scoring structure types
// ---------------------------------------------------------------------------

export type SubCaptionDef = {
  key: string
  label: string
  subPoints: number
  domain: Domain | null
}

export type CaptionDef = {
  name: string
  nameAliases: Array<string>
  domain: Domain | null
  domainSplit?: Partial<Record<Domain, number>>
  maxPoints: number
  pctOfTotal: number
  subCaptions: Array<SubCaptionDef>
  judgeCount: { regional: number; championship: number }
}

export type MarchingEra = {
  era: number | string
  label: string
  startYear: number
  endYear: number | null
  isVirtual?: boolean
  totalPoints: number
  rawMax?: number
  finalDivisor?: number
  musicToVisualRatio: { music: number; visual: number }
  notes: Array<string>
  captions: Array<CaptionDef>
}

export type CaptionDef2021 = {
  name: string
  domain: Domain | null
  domainSplit?: Partial<Record<Domain, number>>
  judgeCount: number
  pointsPerJudge: number
  maxTotal: number
  finalDivisor?: number
  pctOfFinal?: number
  subCaptions: Array<SubCaptionDef>
}

export type Era2021Virtual = {
  era: '2021v'
  label: string
  startYear: 2021
  endYear: 2021
  isVirtual: true
  totalPoints: number
  rawMax: number
  finalDivisor: number
  musicToVisualRatio: { music: number; visual: number }
  notes: Array<string>
  marchingCaptions: Array<CaptionDef2021>
  standstillCaptions: Array<CaptionDef2021>
}

export type ConcertSchema = {
  label: string
  startYear: number
  endYear: number | null
  totalPoints: number
  notes: Array<string>
  captions: Array<CaptionDef>
}

// ---------------------------------------------------------------------------
// Score data types — parsed from HTML recaps
// ---------------------------------------------------------------------------

export type SubCaptionScore = {
  key: string
  rawScore: number
  rank: number | null
}

export type JudgeScore = {
  judgeName: string
  subCaptions: Array<SubCaptionScore>
  total: number
  rank: number | null
}

export type CaptionScore = {
  captionName: string
  judges: Array<JudgeScore>
  captionTotal: number
  captionRank: number | null
}

export type EnsembleScore = {
  ensembleName: string
  location: string
  captions: Array<CaptionScore>
  subTotal: number
  penalty: number
  total: number
  rank: number
}

// ---------------------------------------------------------------------------
// Class / Division types
// ---------------------------------------------------------------------------

export type ClassType = 'marching' | 'concert' | 'standstill'

export type ClassDef = {
  id: string
  name: string
  classType: ClassType
}

export type ClassResult = {
  classDef: ClassDef
  ensembles: Array<EnsembleScore>
}

// ---------------------------------------------------------------------------
// Show / Season types
// ---------------------------------------------------------------------------

export type ShowMetadata = {
  id: string
  eventName: string
  venue: string
  date: string
  round: string
  year: number
}

export type ShowData = {
  metadata: ShowMetadata
  classes: Array<ClassResult>
}

export type SeasonShow = {
  id: string
  eventName: string
  date: string
  round: string
  sourceUrl?: string
  sourceHash?: string
  lastImportedUtc?: string
}

export type SeasonMetadata = {
  year: number
  shows: Array<SeasonShow>
  classes: Array<ClassDef>
  incomplete?: boolean
}

// ---------------------------------------------------------------------------
// Ensemble Registry types
// ---------------------------------------------------------------------------

export type EnsembleEntry = {
  id: string
  canonicalName: string
  shortName: string
  aliases: Array<string>
  city: string
  state: string
}

export type EnsembleRegistry = {
  ensembles: Array<EnsembleEntry>
}

export type MatchConfidence = 'exact' | 'alias' | 'fuzzy' | 'unknown'

export type MatchResult = {
  entry: EnsembleEntry | null
  confidence: MatchConfidence
  matchedOn: string | null
}

// ---------------------------------------------------------------------------
// Domain-bucketed scores for cross-era comparison
// ---------------------------------------------------------------------------

export type DomainScores = Partial<Record<Domain, number>>
