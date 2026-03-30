import type { ReactNode } from 'react'

type PanelProps = {
  title?: string
  children: ReactNode
  className?: string
}

export function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wider">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
