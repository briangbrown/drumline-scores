const STORAGE_KEY = 'rmpa-theme'
const CONTRAST_KEY = 'rmpa-contrast'

type Theme = 'light' | 'dark' | 'system'
type Contrast = 'regular' | 'high'

function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function getStoredContrast(): Contrast {
  const stored = localStorage.getItem(CONTRAST_KEY)
  if (stored === 'high') return 'high'
  return 'regular'
}

function getResolvedTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: Theme, contrast?: Contrast) {
  const resolved = getResolvedTheme(theme)
  const c = contrast ?? getStoredContrast()
  document.documentElement.classList.remove('light', 'dark', 'high-contrast')
  document.documentElement.classList.add(resolved)
  if (c === 'high') {
    document.documentElement.classList.add('high-contrast')
  }

  // Update meta theme-color for mobile browsers
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#f5f5f7' : '#080812')
  }
}

export { getStoredTheme, getStoredContrast, applyTheme, STORAGE_KEY, CONTRAST_KEY }
export type { Theme, Contrast }
