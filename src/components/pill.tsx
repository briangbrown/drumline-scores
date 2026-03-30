type PillProps = {
  label: string
  isActive: boolean
  onClick: () => void
}

export function Pill({ label, isActive, onClick }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
        isActive
          ? 'bg-accent text-bg'
          : 'bg-surface-alt text-text-secondary hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  )
}
