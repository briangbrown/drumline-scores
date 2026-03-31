import { Share2 } from 'lucide-react'
import { showToast } from './toast'

export function ShareButton() {
  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied to clipboard')
    } catch {
      showToast('Could not copy link')
    }
  }

  return (
    <button
      onClick={handleShare}
      className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer"
      aria-label="Share"
      title="Copy link to clipboard"
    >
      <Share2 className="h-5 w-5" />
    </button>
  )
}
