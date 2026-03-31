import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import type {
  CaptionScore,
  ClassDef,
  ClassResult,
  ClassType,
  EnsembleScore,
  JudgeScore,
  ShowData,
  ShowMetadata,
  SubCaptionScore,
} from './types'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a CompetitionSuite HTML recap into structured ShowData.
 * Handles format variations across 2015–2025.
 */
export function parseRecapHtml(html: string, year: number): ShowData {
  const $ = cheerio.load(html)
  const metadata = parseMetadata($, year)
  const classes = parseDivisions($)

  return { metadata, classes }
}

// ---------------------------------------------------------------------------
// Metadata parsing
// ---------------------------------------------------------------------------

function parseMetadata($: cheerio.CheerioAPI, year: number): ShowMetadata {
  // Event name: bold 18px div
  const eventName =
    $('div[style*="font-size: 18px"]').first().text().trim() || 'Unknown Event'

  // Date: italic 12px div containing a date
  let date = ''
  $('div[style*="font-style: italic"]').each((_i, el) => {
    const text = $(el).text().trim()
    if (/\d{4}/.test(text) && /\w+day,/.test(text)) {
      date = text
    }
  })

  // Venue: extracted from the date line or a separate line
  let venue = ''
  $('div[style*="font-style: italic"]').each((_i, el) => {
    const text = $(el).text().trim()
    // 2015-2018: venue is after " - " in date line
    if (text.includes(' - ') && /\d{4}/.test(text)) {
      venue = text.split(' - ').slice(1).join(' - ').trim()
    }
  })

  // 2019+: venue may be in a separate 12px italic div
  if (!venue) {
    $('div[style*="font-style: italic"][style*="font-size: 12px"]').each((_i, el) => {
      const text = $(el).text().trim()
      if (!(/\d{4}/.test(text)) && text !== 'Virtual' && text !== 'Finals' && text !== 'Prelims' && text.length > 3) {
        venue = text
      }
    })
  }

  // Round: "Finals", "Prelims", or from round-name div
  let round = ''
  $('div[style*="font-style: italic"][style*="font-size: 14px"]').each((_i, el) => {
    const text = $(el).text().trim()
    if (/finals|prelims|semifinals/i.test(text)) {
      round = text
    }
  })

  // Generate a stable show ID from event name and date
  const id = generateShowId(eventName, date, year)

  return { id, eventName, venue, date, round, year }
}

function generateShowId(eventName: string, date: string, year: number): string {
  const slug = eventName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const dateSlug = date
    .replace(/\w+day,\s*/, '')
    .replace(/,?\s*\d{4}/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${year}-${slug}-${dateSlug}`.replace(/-+/g, '-')
}

// ---------------------------------------------------------------------------
// Division / Class parsing
// ---------------------------------------------------------------------------

function parseDivisions($: cheerio.CheerioAPI): Array<ClassResult> {
  const results: Array<ClassResult> = []

  // Each division is in a separate table with border-bottom style
  const divisionTables = $('table[style*="border-bottom"]')

  divisionTables.each((_i, tableEl) => {
    const table = $(tableEl)

    // Get class name from header
    const className = extractClassName($, table)
    if (!className) return

    // Skip non-percussion classes
    if (isWindsClass(className)) return

    const classDef = classDefFromName(className)
    const ensembles = parseEnsembleRows($, table)

    if (ensembles.length > 0) {
      results.push({ classDef, ensembles })
    }
  })

  return results
}

function extractClassName(_$: cheerio.CheerioAPI, table: cheerio.Cheerio<Element>): string {
  // 2023+: header-division-name class
  const headerDiv = table.find('tr.header-division-name td').first()
  if (headerDiv.length > 0) {
    return headerDiv.text().trim()
  }

  // 2015-2022: First row td with bold 14px inline style
  const headerTd = table.find('tr > td[style*="font-weight: bold"][style*="font-size: 14px"]').first()
  if (headerTd.length > 0) {
    // Remove script tags before extracting text (2015 embeds GA script in header cell)
    const clone = headerTd.clone()
    clone.find('script').remove()
    return clone.text().trim().replace(/\s+/g, ' ')
  }

  return ''
}

function isWindsClass(name: string): boolean {
  return /^winds\s/i.test(name)
}

function classDefFromName(name: string): ClassDef {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  let classType: ClassType = 'marching'
  if (/concert/i.test(name)) classType = 'concert'
  else if (/standstill/i.test(name)) classType = 'standstill'
  // "Small Ensemble" is a special case — treat as standstill
  else if (/small ensemble/i.test(name)) classType = 'standstill'

  return { id, name, classType }
}

// ---------------------------------------------------------------------------
// Ensemble row parsing
// ---------------------------------------------------------------------------

function parseEnsembleRows(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>,
): Array<EnsembleScore> {
  // Parse the header structure to understand column layout
  const layout = parseHeaderLayout($, table)
  if (!layout) return []

  const ensembles: Array<EnsembleScore> = []

  // Find ensemble rows: rows with topBorder class that contain score data
  const innerTable = table.find('table[style*="background-color"]')
  const targetTable = innerTable.length > 0 ? innerTable : table

  const allRows = targetTable.find('tr')
  allRows.each((_i, rowEl) => {
    const row = $(rowEl)
    const cells = row.children('td')
    if (cells.length < 5) return

    const firstCell = cells.first()
    // Ensemble name rows have rightBorderDouble on first cell and contain text (not headers)
    const hasRightBorderDouble = (firstCell.attr('class') ?? '').includes('rightBorderDouble')
    const isHeader = (firstCell.attr('class') ?? '').includes('header') ||
      (firstCell.attr('class') ?? '').includes('bottomBorderDouble')
    const cellText = firstCell.text().trim()

    if (!hasRightBorderDouble || isHeader || !cellText || cellText === '&nbsp;' || cellText === '\u00a0') return

    const ensemble = parseEnsembleRow($, row, layout)
    if (ensemble) {
      ensembles.push(ensemble)
    }
  })

  return ensembles
}

// ---------------------------------------------------------------------------
// Header layout parsing — determines column positions
// ---------------------------------------------------------------------------

type CaptionLayout = {
  captionName: string
  judges: Array<{
    judgeName: string
    subCaptionKeys: Array<string>
    colStart: number
    colCount: number
  }>
  totalCol: number | null
}

type HeaderLayout = {
  hasLocation: boolean
  captions: Array<CaptionLayout>
  subTotalCol: number | null
  penaltyCol: number | null
  totalCol: number | null
  dataStartCol: number
}

function parseHeaderLayout(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<Element>,
): HeaderLayout | null {
  const innerTable = table.find('table[style*="background-color"]')
  const targetTable = innerTable.length > 0 ? innerTable : table

  const headerRows = targetTable.find('tr').filter((_i, el) => {
    const row = $(el)
    return row.find('td.header').length > 0 || row.find('td.bottomBorderDouble').length > 0
  })

  if (headerRows.length < 2) return null

  // Detect location column: check if first data row has a second cell with padding style
  const firstDataRow = targetTable.find('tr').filter((_i, el) => {
    const row = $(el)
    const firstCell = row.children('td').first()
    const cls = firstCell.attr('class') ?? ''
    const text = firstCell.text().trim()
    return cls.includes('rightBorderDouble') && !cls.includes('header') &&
      !cls.includes('bottomBorderDouble') && text.length > 0 && text !== '\u00a0'
  }).first()

  let hasLocation = false
  if (firstDataRow.length > 0) {
    const secondCell = firstDataRow.children('td').eq(1)
    const style = secondCell.attr('style') ?? ''
    const cls = secondCell.attr('class') ?? ''
    hasLocation = style.includes('padding-left') && cls.includes('rightBorderDouble')
  }

  // Parse row 3 (sub-caption keys)
  const subCaptionRow = headerRows.last()
  const subCaptionCells = subCaptionRow.children('td')

  // Parse row 1 to get caption names and their column spans
  const captionRow = headerRows.first()
  const captionCells = captionRow.children('td')

  const captions: Array<CaptionLayout> = []
  const captionNames: Array<{ name: string; colspan: number }> = []

  captionCells.each((_i, el) => {
    const cell = $(el)
    const text = cell.text().trim()
    const cls = cell.attr('class') ?? ''
    const colspan = parseInt(cell.attr('colspan') ?? '1', 10)

    if (cell.attr('rowspan')) return

    if (cls.includes('captionTotal') && text && text !== '&nbsp;' && text !== '\u00a0') {
      captionNames.push({ name: text, colspan })
    }
  })

  // Parse row 2 to get judge names
  const judgeRow = headerRows.eq(1)
  const judgeCells = judgeRow.children('td')
  const judges: Array<{ name: string; colspan: number }> = []

  judgeCells.each((_i, el) => {
    const cell = $(el)
    const text = cell.text().trim()
    const colspan = parseInt(cell.attr('colspan') ?? '1', 10)
    const cls = cell.attr('class') ?? ''

    if (cell.attr('rowspan')) return

    if (cls.includes('subcaptionTotal') || (cls.includes('header') && text && text !== '&nbsp;' && text !== '\u00a0')) {
      judges.push({ name: text, colspan })
    } else if (cls.includes('captionTotal')) {
      judges.push({ name: '__captionTotal__', colspan })
    }
  })

  // Parse row 3 to get sub-caption keys
  const subKeys: Array<{ key: string; type: 'sub' | 'subTotal' | 'captionTotal' }> = []
  subCaptionCells.each((_i, el) => {
    const cell = $(el)
    const text = cell.text().trim()
    const cls = cell.attr('class') ?? ''

    if (cell.attr('rowspan')) return

    if (cls.includes('captionTotal')) {
      subKeys.push({ key: text, type: 'captionTotal' })
    } else if (cls.includes('subcaptionTotal')) {
      subKeys.push({ key: text, type: 'subTotal' })
    } else {
      subKeys.push({ key: text, type: 'sub' })
    }
  })

  // Build the layout by mapping captions → judges → sub-captions
  const dataStartCol = hasLocation ? 2 : 1
  let colIdx = 0
  let judgeIdx = 0

  for (const caption of captionNames) {
    if (/timing|penalt/i.test(caption.name)) {
      colIdx += caption.colspan
      let judgeColsUsed = 0
      while (judgeColsUsed < caption.colspan && judgeIdx < judges.length) {
        judgeColsUsed += judges[judgeIdx].colspan
        judgeIdx++
      }
      continue
    }

    const captionLayout: CaptionLayout = {
      captionName: caption.name,
      judges: [],
      totalCol: null,
    }

    let captionColsUsed = 0
    while (captionColsUsed < caption.colspan && judgeIdx < judges.length) {
      const judge = judges[judgeIdx]
      if (judge.name === '__captionTotal__') {
        captionLayout.totalCol = colIdx + captionColsUsed
        captionColsUsed += judge.colspan
        judgeIdx++
        continue
      }

      const judgeSubKeys: Array<string> = []
      const startSubIdx = colIdx + captionColsUsed

      for (let i = 0; i < judge.colspan && (startSubIdx + i - colIdx) < caption.colspan; i++) {
        const subKeyIdx = startSubIdx + i
        if (subKeyIdx < subKeys.length) {
          const sk = subKeys[subKeyIdx]
          if (sk.type === 'sub') {
            judgeSubKeys.push(sk.key)
          }
        }
      }

      captionLayout.judges.push({
        judgeName: judge.name,
        subCaptionKeys: judgeSubKeys,
        colStart: dataStartCol + startSubIdx,
        colCount: judge.colspan,
      })

      captionColsUsed += judge.colspan
      judgeIdx++
    }

    colIdx += captionColsUsed
    captions.push(captionLayout)
  }

  const subTotalCol: number | null = null
  const penaltyCol: number | null = null
  const totalCol: number | null = null

  return {
    hasLocation,
    captions,
    subTotalCol,
    penaltyCol,
    totalCol,
    dataStartCol,
  }
}

// ---------------------------------------------------------------------------
// Single ensemble row parsing
// ---------------------------------------------------------------------------

function parseEnsembleRow(
  $: cheerio.CheerioAPI,
  row: cheerio.Cheerio<Element>,
  layout: HeaderLayout,
): EnsembleScore | null {
  const cells = row.children('td')
  if (cells.length < 3) return null

  const ensembleName = cells.first().text().trim()
  if (!ensembleName) return null

  let location = ''
  if (layout.hasLocation) {
    location = cells.eq(1).text().trim()
  }

  // Extract all score values from the row
  const scoreValues = extractScoreValues($, cells, layout.dataStartCol)

  // Build caption scores from the layout
  const captions: Array<CaptionScore> = []

  for (const captionLayout of layout.captions) {
    const captionScore = buildCaptionScore(captionLayout, scoreValues)
    captions.push(captionScore)
  }

  // Extract SubTotal, Penalty, Total from the end of the row
  const allScoreCells = cells.filter((_i, el) => {
    const cell = $(el)
    return cell.find('.score').length > 0 || cell.find('table.scoreTable').length > 0
  })

  const totalScoreCells = allScoreCells.length
  const totalVal = extractScoreFromCell($, allScoreCells.eq(totalScoreCells - 1))
  const totalRank = extractRankFromCell($, allScoreCells.eq(totalScoreCells - 1))

  let penalty = 0
  let subTotal = totalVal

  if (totalScoreCells >= 3) {
    const secondToLast = extractScoreFromCell($, allScoreCells.eq(totalScoreCells - 2))
    const thirdToLast = extractScoreFromCell($, allScoreCells.eq(totalScoreCells - 3))

    if (Math.abs(thirdToLast - totalVal) > 0.001 && secondToLast !== totalVal) {
      subTotal = thirdToLast
      penalty = secondToLast
    } else {
      subTotal = secondToLast !== totalVal ? secondToLast : thirdToLast
    }
  }

  return {
    ensembleName,
    location,
    captions,
    subTotal,
    penalty,
    total: totalVal,
    rank: totalRank ?? 0,
  }
}

function buildCaptionScore(
  captionLayout: CaptionLayout,
  scoreValues: Array<{ score: number; rank: number | null }>,
): CaptionScore {
  const judges: Array<JudgeScore> = []
  let scoreIdx = 0

  for (const judge of captionLayout.judges) {
    const subCaptions: Array<SubCaptionScore> = []

    for (const key of judge.subCaptionKeys) {
      if (scoreIdx < scoreValues.length) {
        subCaptions.push({
          key,
          rawScore: scoreValues[scoreIdx].score,
          rank: scoreValues[scoreIdx].rank,
        })
        scoreIdx++
      }
    }

    // Judge subtotal (the *Tot column)
    let judgeTotal = 0
    let judgeRank: number | null = null
    if (scoreIdx < scoreValues.length) {
      judgeTotal = scoreValues[scoreIdx].score
      judgeRank = scoreValues[scoreIdx].rank
      scoreIdx++
    }

    judges.push({
      judgeName: judge.judgeName,
      subCaptions,
      total: judgeTotal,
      rank: judgeRank,
    })
  }

  // Caption total — consume from a dedicated total column when present (double-panel),
  // otherwise infer from the single judge's total (single-panel regional shows)
  let captionTotal = 0
  let captionRank: number | null = null
  if (captionLayout.totalCol !== null && scoreIdx < scoreValues.length) {
    captionTotal = scoreValues[scoreIdx].score
    captionRank = scoreValues[scoreIdx].rank
    scoreIdx++
  } else if (judges.length === 1) {
    captionTotal = judges[0].total
    captionRank = judges[0].rank
  }

  // Remove consumed values from the front
  scoreValues.splice(0, scoreIdx)

  return {
    captionName: captionLayout.captionName,
    judges,
    captionTotal,
    captionRank,
  }
}

function extractScoreValues(
  $: cheerio.CheerioAPI,
  cells: cheerio.Cheerio<Element>,
  dataStartCol: number,
): Array<{ score: number; rank: number | null }> {
  const values: Array<{ score: number; rank: number | null }> = []

  cells.each((i, el) => {
    if (i < dataStartCol) return

    const cell = $(el)
    const scoreTable = cell.find('table.scoreTable')
    if (scoreTable.length === 0) return

    values.push({
      score: extractScoreFromCell($, cell),
      rank: extractRankFromCell($, cell),
    })
  })

  return values
}

function extractScoreFromCell(_$: cheerio.CheerioAPI, cell: cheerio.Cheerio<Element>): number {
  const scoreEl = cell.find('.score').first()
  if (scoreEl.length === 0) return 0

  // 2019+: use data-translate-number attribute
  const dataAttr = scoreEl.attr('data-translate-number')
  if (dataAttr !== undefined) {
    if (dataAttr === '') return 0
    return parseFloat(dataAttr)
  }

  // 2015-2018: use text content
  const text = scoreEl.text().trim()
  if (!text) return 0
  return parseFloat(text)
}

function extractRankFromCell(_$: cheerio.CheerioAPI, cell: cheerio.Cheerio<Element>): number | null {
  const rankEl = cell.find('.rank').first()
  if (rankEl.length === 0) return null
  const text = rankEl.text().trim()
  if (!text) return null
  const rank = parseInt(text, 10)
  return isNaN(rank) ? null : rank
}

// ---------------------------------------------------------------------------
// Class ID helpers
// ---------------------------------------------------------------------------

const CLASS_ABBREVIATIONS: Record<string, string> = {
  'Percussion Scholastic Concert Regional A': 'PSCRA',
  'Percussion Scholastic Standstill Regional A': 'PSSRA',
  'Percussion Scholastic Regional A': 'PSRA',
  'Percussion Scholastic Concert A': 'PSCA',
  'Percussion Scholastic Standstill A': 'PSSA',
  'Percussion Scholastic A': 'PSA',
  'Percussion Scholastic Concert Open': 'PSCO',
  'Percussion Scholastic Standstill Open': 'PSSO',
  'Percussion Scholastic Open': 'PSO',
  'Percussion Scholastic Concert World': 'PSCW',
  'Percussion Scholastic World': 'PSW',
  'Percussion Scholastic National A': 'PSNA',
  'Percussion Independent A': 'PIA',
  'Percussion Independent Standstill A': 'PISA',
  'Percussion Independent Open': 'PIO',
  'Percussion Independent World': 'PIW',
  'Small Ensemble - Percussion Independent': 'SEPI',
}

/**
 * Get a short abbreviation for a class name.
 */
export function getClassAbbreviation(className: string): string {
  return CLASS_ABBREVIATIONS[className] ?? className
}
