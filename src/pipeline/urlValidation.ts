/**
 * Validate that a URL belongs to the competitionsuite.com domain.
 *
 * Uses the URL constructor for proper parsing instead of substring matching,
 * preventing spoofed domains like `not-competitionsuite.com` or
 * `competitionsuite.com.evil.com` from passing validation.
 */
function isCompetitionSuiteUrl(href: string): boolean {
  try {
    // Only accept absolute URLs — relative paths should not pass validation
    // since the scraped pages are on rmpa.org, not competitionsuite.com
    const parsed = new URL(href)
    return (
      parsed.hostname === 'competitionsuite.com' ||
      parsed.hostname.endsWith('.competitionsuite.com')
    )
  } catch {
    // Relative URLs or invalid strings fail — they cannot be competitionsuite.com
    return false
  }
}

export { isCompetitionSuiteUrl }
