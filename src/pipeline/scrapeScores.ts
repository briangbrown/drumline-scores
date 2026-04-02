import { load } from 'cheerio'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecapEntry = {
  date: string
  eventName: string
  recapUrl: string
  year: number
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Parse the rmpa.org/scores HTML page and extract all recap entries.
 *
 * Structure: each year is a `<ul class="list-group">` containing
 *   - a header `<li class="list-group-item active">` with the year text
 *   - entry `<li class="list-group-item">` with an `<a>` (date + URL) and
 *     adjacent text (event name)
 */
function parseScorePage(html: string): Array<RecapEntry> {
  const $ = load(html)
  const entries: Array<RecapEntry> = []

  $('ul.list-group').each((_i, ul) => {
    const yearText = $(ul).find('li.list-group-item.active').text().trim()
    const year = parseInt(yearText, 10)
    if (isNaN(year)) return

    $(ul).find('li.list-group-item:not(.active)').each((_j, li) => {
      const anchor = $(li).find('a')
      if (anchor.length === 0) return

      const href = anchor.attr('href')
      if (!href || !href.includes('competitionsuite.com')) return

      const dateText = anchor.text().trim()
      // Event name is the text content of the <li> after the <a>
      const fullText = $(li).text().trim()
      const eventName = fullText.replace(dateText, '').trim()

      entries.push({
        date: dateText,
        eventName,
        recapUrl: href,
        year,
      })
    })
  })

  return entries
}

function filterByYear(entries: Array<RecapEntry>, year: number): Array<RecapEntry> {
  return entries.filter((e) => e.year === year)
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { parseScorePage, filterByYear }
export type { RecapEntry }
