type StarButtonProps = {
  isFavorited: boolean
  onClick: () => void
  size?: 'sm' | 'md'
}

export function StarButton({ isFavorited, onClick, size = 'sm' }: StarButtonProps) {
  const sizeClass = size === 'sm' ? 'text-lg sm:text-xl' : 'text-2xl'

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`cursor-pointer transition-colors ${sizeClass} ${
        isFavorited ? 'text-accent' : 'text-text-muted hover:text-accent/70'
      }`}
      title={isFavorited ? 'Remove from favorites' : 'Set as favorite'}
      aria-label={isFavorited ? 'Remove from favorites' : 'Set as favorite'}
    >
      {isFavorited ? '\u2605' : '\u2606'}
    </button>
  )
}
