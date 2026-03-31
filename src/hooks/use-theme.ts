const STORAGE_KEY = 'rmpa-theme'

type Theme = 'light' | 'dark' | 'system'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function getResolvedTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  const resolved = getResolvedTheme(theme)
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)

  // Update meta theme-color for mobile browsers
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#f5f5f7' : '#080812')
  }
}

// Apply immediately on load (before React mounts) to prevent flash
applyTheme(getStoredTheme())

export { getStoredTheme, applyTheme, STORAGE_KEY }
export type { Theme }
