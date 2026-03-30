import { useState, useEffect } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    // Check if iOS (needs manual Add to Home Screen)
    const ua = navigator.userAgent
    const isIosDevice = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    setIsIos(isIosDevice && !isStandalone)

    // Listen for the install prompt (Chrome, Edge, etc.)
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Check if already dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem('rmpa-install-dismissed')) {
      setIsDismissed(true)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    sessionStorage.setItem('rmpa-install-dismissed', '1')
  }

  // Already installed or dismissed
  if (isDismissed) return null
  if (window.matchMedia('(display-mode: standalone)').matches) return null

  // Show iOS guidance
  if (isIos) {
    return (
      <div className="mx-auto max-w-[920px] px-4 mb-4">
        <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-xs">
          <span>
            Install this app: tap{' '}
            <span className="inline-block mx-0.5 text-base align-middle">&#x1F4E4;</span>{' '}
            then &quot;Add to Home Screen&quot;
          </span>
          <button
            onClick={handleDismiss}
            className="ml-3 text-text-muted hover:text-text-primary cursor-pointer"
            aria-label="Dismiss"
          >
            &#x2715;
          </button>
        </div>
      </div>
    )
  }

  // Show install button (Android/desktop Chrome)
  if (deferredPrompt) {
    return (
      <div className="mx-auto max-w-[920px] px-4 mb-4">
        <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-xs">
          <span>Install RMPA Score Tracker for quick access</span>
          <div className="flex items-center gap-2 ml-3">
            <button
              onClick={handleInstall}
              className="rounded-full bg-accent px-3 py-1 text-bg font-medium cursor-pointer"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="text-text-muted hover:text-text-primary cursor-pointer"
              aria-label="Dismiss"
            >
              &#x2715;
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
