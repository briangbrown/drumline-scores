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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-5 w-5"
      >
        <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .799l6.733 3.365a2.5 2.5 0 1 1-.671 1.341l-6.733-3.365a2.5 2.5 0 1 1 0-3.482l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
      </svg>
    </button>
  )
}
