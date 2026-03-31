import { describe, it, expect } from 'vitest'
import { parseShowDate } from './data'

describe('parseShowDate', () => {
  it('should parse a date with venue suffix', () => {
    const date = parseShowDate('Saturday, February 27, 2016 - Heritage High School')
    expect(date.getFullYear()).toBe(2016)
    expect(date.getMonth()).toBe(1) // February = 1
    expect(date.getDate()).toBe(27)
  })

  it('should parse a date without venue suffix', () => {
    const date = parseShowDate('Saturday, April 6, 2019')
    expect(date.getFullYear()).toBe(2019)
    expect(date.getMonth()).toBe(3) // April = 3
    expect(date.getDate()).toBe(6)
  })

  it('should produce correct sort order for 2016 season dates', () => {
    const dates = [
      'Saturday, April 9, 2016 - United States Air Force Academy',
      'Saturday, February 27, 2016 - Heritage High School',
      'Saturday, March 12, 2016 - Pomona High School',
      'Saturday, March 19, 2016 - Mountain Range',
      'Saturday, March 26, 2016 - Longmont High School',
    ]
    const sorted = [...dates].sort(
      (a, b) => parseShowDate(a).getTime() - parseShowDate(b).getTime(),
    )
    expect(sorted).toEqual([
      'Saturday, February 27, 2016 - Heritage High School',
      'Saturday, March 12, 2016 - Pomona High School',
      'Saturday, March 19, 2016 - Mountain Range',
      'Saturday, March 26, 2016 - Longmont High School',
      'Saturday, April 9, 2016 - United States Air Force Academy',
    ])
  })
})
