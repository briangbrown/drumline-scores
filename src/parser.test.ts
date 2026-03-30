import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseRecapHtml, getClassAbbreviation } from './parser'

function loadHtml(filename: string): string {
  return readFileSync(resolve(__dirname, `../data/scores/${filename}`), 'utf-8')
}

describe('parseRecapHtml — 2025 (Era 2, latest format)', () => {
  const html = loadHtml('March, 29 2025 RMPA State Championships.html')
  const result = parseRecapHtml(html, 2025)

  it('should parse show metadata', () => {
    expect(result.metadata.year).toBe(2025)
    expect(result.metadata.eventName).toContain('RMPA')
    expect(result.metadata.round).toBe('Finals')
  })

  it('should parse multiple classes', () => {
    expect(result.classes.length).toBeGreaterThan(5)
  })

  it('should skip Winds classes', () => {
    const classNames = result.classes.map((c) => c.classDef.name)
    expect(classNames.every((n) => !n.startsWith('Winds'))).toBe(true)
  })

  it('should parse ensemble names and locations', () => {
    const firstClass = result.classes[0]
    expect(firstClass.ensembles.length).toBeGreaterThan(0)
    const firstEnsemble = firstClass.ensembles[0]
    expect(firstEnsemble.ensembleName.length).toBeGreaterThan(0)
    // 2025 has location column
    expect(firstEnsemble.location.length).toBeGreaterThan(0)
  })

  it('should parse score values', () => {
    const firstEnsemble = result.classes[0].ensembles[0]
    expect(firstEnsemble.total).toBeGreaterThan(0)
    expect(firstEnsemble.rank).toBeGreaterThan(0)
    expect(firstEnsemble.captions.length).toBeGreaterThan(0)
  })

  it('should parse judge-level detail', () => {
    const firstEnsemble = result.classes[0].ensembles[0]
    const firstCaption = firstEnsemble.captions[0]
    expect(firstCaption.judges.length).toBeGreaterThan(0)
    const firstJudge = firstCaption.judges[0]
    expect(firstJudge.judgeName.length).toBeGreaterThan(0)
    expect(firstJudge.subCaptions.length).toBeGreaterThan(0)
    expect(firstJudge.total).toBeGreaterThan(0)
  })

  it('should identify class types correctly', () => {
    const classTypes = result.classes.map((c) => ({
      name: c.classDef.name,
      type: c.classDef.classType,
    }))
    const concert = classTypes.find((c) => /concert/i.test(c.name))
    const standstill = classTypes.find((c) => /standstill/i.test(c.name))
    const marching = classTypes.find((c) => !/concert|standstill/i.test(c.name))

    if (concert) expect(concert.type).toBe('concert')
    if (standstill) expect(standstill.type).toBe('standstill')
    if (marching) expect(marching.type).toBe('marching')
  })
})

describe('parseRecapHtml — 2023 (Era 2, header-division-name class)', () => {
  const html = loadHtml('April, 15 2023 RMPA Championships.html')
  const result = parseRecapHtml(html, 2023)

  it('should parse classes with header-division-name', () => {
    expect(result.classes.length).toBeGreaterThan(5)
  })

  it('should parse concert class with Music + Artistry captions', () => {
    const concert = result.classes.find((c) => /concert/i.test(c.classDef.name))
    expect(concert).toBeDefined()
    if (!concert) return
    const captionNames = concert.ensembles[0].captions.map((c) => c.captionName)
    expect(captionNames).toContain('Music')
    expect(captionNames).toContain('Artistry')
  })

  it('should parse Alameda PSCRA total as 79.500', () => {
    const concert = result.classes.find((c) => c.classDef.name === 'Percussion Scholastic Concert Regional A')
    expect(concert).toBeDefined()
    if (!concert) return
    const alameda = concert.ensembles.find((e) => /alameda/i.test(e.ensembleName))
    expect(alameda).toBeDefined()
    if (!alameda) return
    expect(alameda.total).toBeCloseTo(79.5, 1)
    expect(alameda.rank).toBe(1)
  })
})

describe('parseRecapHtml — 2021 (Virtual, IMP/AN/VAN format)', () => {
  const html = loadHtml('April, 9 2021 RMPA Championships.html')
  const result = parseRecapHtml(html, 2021)

  it('should parse virtual show metadata', () => {
    expect(result.metadata.year).toBe(2021)
  })

  it('should parse classes', () => {
    expect(result.classes.length).toBeGreaterThan(0)
  })

  it('should parse marching class with Music + Visual captions', () => {
    const marching = result.classes.find((c) =>
      c.classDef.classType === 'marching' && c.ensembles.length > 0)
    expect(marching).toBeDefined()
    if (!marching) return
    const captionNames = marching.ensembles[0].captions.map((c) => c.captionName)
    expect(captionNames).toContain('Music')
    expect(captionNames).toContain('Visual')
  })

  it('should parse Highlands Ranch PSRA total as 82.250', () => {
    const psra = result.classes.find((c) => /Scholastic Regional A$/i.test(c.classDef.name))
    expect(psra).toBeDefined()
    if (!psra) return
    const hr = psra.ensembles.find((e) => /highlands ranch/i.test(e.ensembleName))
    expect(hr).toBeDefined()
    if (!hr) return
    expect(hr.total).toBeCloseTo(82.25, 2)
  })
})

describe('parseRecapHtml — 2015 (Era 1, text-only scores)', () => {
  const html = loadHtml('April, 4 2015 RMPA Championships.html')
  const result = parseRecapHtml(html, 2015)

  it('should parse classes', () => {
    expect(result.classes.length).toBeGreaterThan(0)
  })

  it('should parse scores from text content (no data-translate-number)', () => {
    const firstClass = result.classes[0]
    expect(firstClass.ensembles.length).toBeGreaterThan(0)
    const firstEnsemble = firstClass.ensembles[0]
    expect(firstEnsemble.total).toBeGreaterThan(0)
  })

  it('should parse Dakota Ridge PSCA total as 90.225', () => {
    const psca = result.classes.find((c) => /Concert A$/i.test(c.classDef.name))
    expect(psca).toBeDefined()
    if (!psca) return
    const dr = psca.ensembles.find((e) => /dakota ridge/i.test(e.ensembleName))
    expect(dr).toBeDefined()
    if (!dr) return
    expect(dr.total).toBeCloseTo(90.225, 2)
  })
})

describe('parseRecapHtml — 2016 (Era 2 transition)', () => {
  const html = loadHtml('April, 9 2016 RMPA Championships.html')
  const result = parseRecapHtml(html, 2016)

  it('should parse Era 2 with 4 captions for marching classes', () => {
    const marching = result.classes.find((c) =>
      c.classDef.classType === 'marching' && c.ensembles.length > 0)
    expect(marching).toBeDefined()
    if (!marching) return
    const captionNames = marching.ensembles[0].captions.map((c) => c.captionName)
    // Era 2 should have Effect – Music, Effect – Visual, Music, Visual
    expect(captionNames.length).toBeGreaterThanOrEqual(4)
  })
})

describe('parseRecapHtml — 2020 (regular season contest)', () => {
  const html = loadHtml('February, 29 2020 RMPA contest #3.html')
  const result = parseRecapHtml(html, 2020)

  it('should parse classes', () => {
    expect(result.classes.length).toBeGreaterThan(0)
  })

  it('should skip Winds classes', () => {
    const classNames = result.classes.map((c) => c.classDef.name)
    expect(classNames.every((n) => !n.startsWith('Winds'))).toBe(true)
  })
})

describe('getClassAbbreviation', () => {
  it('should return known abbreviations', () => {
    expect(getClassAbbreviation('Percussion Scholastic A')).toBe('PSA')
    expect(getClassAbbreviation('Percussion Independent World')).toBe('PIW')
    expect(getClassAbbreviation('Percussion Scholastic Concert Open')).toBe('PSCO')
  })

  it('should return original name for unknown classes', () => {
    expect(getClassAbbreviation('Unknown Class')).toBe('Unknown Class')
  })
})
