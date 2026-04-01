import { useState, useEffect } from 'react'
import { Settings, X, Sun, Moon, Monitor } from 'lucide-react'
import { getStoredTheme, getStoredContrast, applyTheme, STORAGE_KEY, CONTRAST_KEY } from '../hooks/use-theme'
import type { Theme, Contrast } from '../hooks/use-theme'
import type { LucideIcon } from 'lucide-react'

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

type SettingsDialogProps = {
  isOpen: boolean
  onClose: () => void
}

function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [contrast, setContrast] = useState<Contrast>(getStoredContrast)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    applyTheme(newTheme, contrast)
  }

  const handleContrastToggle = () => {
    const newContrast: Contrast = contrast === 'regular' ? 'high' : 'regular'
    setContrast(newContrast)
    localStorage.setItem(CONTRAST_KEY, newContrast)
    applyTheme(theme, newContrast)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm mx-4 rounded-xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-5">
          {/* Theme selector */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">
              Theme
            </p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleThemeChange(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg px-3 py-3 text-xs font-medium transition-colors cursor-pointer border ${
                      theme === opt.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface-alt text-text-secondary hover:text-text-primary hover:border-text-muted/50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Contrast toggle */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">
              Contrast
            </p>
            <button
              onClick={handleContrastToggle}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-alt px-4 py-3 transition-colors cursor-pointer hover:border-text-muted/50"
            >
              <span className="text-xs font-medium text-text-secondary">High Contrast</span>
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                  contrast === 'high' ? 'bg-accent border-accent' : 'bg-border border-text-muted/40'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    contrast === 'high' ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false)

  // Listen for system theme changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => {
      if (getStoredTheme() === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
        aria-label="Settings"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </button>
      <SettingsDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
