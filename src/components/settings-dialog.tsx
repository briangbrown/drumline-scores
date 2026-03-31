import { useState, useEffect } from 'react'
import { getStoredTheme, applyTheme, STORAGE_KEY } from '../hooks/use-theme'
import type { Theme } from '../hooks/use-theme'

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: string }> = [
  { value: 'light', label: 'Light', icon: '\u2600' },
  { value: 'dark', label: 'Dark', icon: '\u263E' },
  { value: 'system', label: 'System', icon: '\u2699' },
]

type SettingsDialogProps = {
  isOpen: boolean
  onClose: () => void
}

function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

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
    applyTheme(newTheme)
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          <p className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">
            Theme
          </p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleThemeChange(opt.value)}
                className={`flex flex-col items-center gap-1.5 rounded-lg px-3 py-3 text-xs font-medium transition-colors cursor-pointer border ${
                  theme === opt.value
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface-alt text-text-secondary hover:text-text-primary hover:border-text-muted/50'
                }`}
              >
                <span className="text-lg">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path
            fillRule="evenodd"
            d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <SettingsDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
