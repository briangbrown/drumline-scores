import { describe, it, expect } from 'vitest'
import { isCompetitionSuiteUrl } from './urlValidation'

describe('isCompetitionSuiteUrl', () => {
  it('should accept exact competitionsuite.com domain', () => {
    expect(isCompetitionSuiteUrl('https://competitionsuite.com/page')).toBe(true)
  })

  it('should accept subdomains of competitionsuite.com', () => {
    expect(isCompetitionSuiteUrl('https://recaps.competitionsuite.com/2025.htm')).toBe(true)
    expect(isCompetitionSuiteUrl('https://schedules.competitionsuite.com/show_standard.htm')).toBe(true)
  })

  it('should reject domains that contain competitionsuite.com as a substring prefix', () => {
    expect(isCompetitionSuiteUrl('https://not-competitionsuite.com/page')).toBe(false)
  })

  it('should reject competitionsuite.com embedded in path', () => {
    expect(isCompetitionSuiteUrl('https://evil.com/competitionsuite.com')).toBe(false)
  })

  it('should reject competitionsuite.com as a subdomain of another domain', () => {
    expect(isCompetitionSuiteUrl('https://competitionsuite.com.evil.com/page')).toBe(false)
  })

  it('should reject relative URLs', () => {
    expect(isCompetitionSuiteUrl('/some/path')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isCompetitionSuiteUrl('')).toBe(false)
  })

  it('should return false for completely invalid URLs', () => {
    expect(isCompetitionSuiteUrl('not a url %%')).toBe(false)
  })

  it('should reject http://evil.com scheme with competitionsuite in path', () => {
    expect(isCompetitionSuiteUrl('http://evil.com/recaps.competitionsuite.com/page')).toBe(false)
  })
})
