import type { Ref } from 'react'

type PillProps = {
  label: string
  isActive: boolean
  onClick: () => void
  ref?: Ref<HTMLButtonElement>
  isFlashing?: boolean
}

export function Pill({ label, isActive, onClick, ref, isFlashing }: PillProps) {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
        isActive
          ? 'bg-accent text-bg'
          : 'bg-surface-alt text-text-secondary hover:text-text-primary'
      } ${isFlashing ? 'pill-flash' : ''}`}
    >
      {label}
    </button>
  )
}
