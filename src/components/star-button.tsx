import { Star } from 'lucide-react'

type StarButtonProps = {
  isFavorited: boolean
  onClick: () => void
  size?: 'sm' | 'md'
}

const SIZE_CLASSES = {
  sm: 'h-3.5 w-3.5 sm:h-4 sm:w-4',
  md: 'h-5 w-5',
}

export function StarButton({ isFavorited, onClick, size = 'sm' }: StarButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`cursor-pointer transition-colors ${
        isFavorited ? 'text-accent' : 'text-text-muted hover:text-accent/70'
      }`}
      title={isFavorited ? 'Remove from favorites' : 'Set as favorite'}
      aria-label={isFavorited ? 'Remove from favorites' : 'Set as favorite'}
    >
      <Star
        className={SIZE_CLASSES[size]}
        fill={isFavorited ? 'currentColor' : 'none'}
      />
    </button>
  )
}
