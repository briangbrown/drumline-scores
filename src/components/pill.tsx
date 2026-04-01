import type { ReactNode, Ref } from 'react'

type PillProps = {
  label: ReactNode
  isActive: boolean
  onClick: () => void
  ref?: Ref<HTMLButtonElement>
  isFlashing?: boolean
  disabled?: boolean
}

export function Pill({ label, isActive, onClick, ref, isFlashing, disabled }: PillProps) {
  return (
    <button
      ref={ref}
      data-active={isActive || undefined}
      onClick={disabled ? undefined : onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
        disabled
          ? 'bg-surface-alt text-text-muted cursor-not-allowed opacity-50'
          : isActive
            ? 'bg-accent text-bg cursor-pointer'
            : 'bg-surface-alt text-text-secondary hover:text-text-primary cursor-pointer'
      } ${isFlashing ? 'pill-flash' : ''}`}
    >
      {label}
    </button>
  )
}
