import { useState, useRef, useEffect } from 'react'
import type { ReactElement } from 'react'

type ChartContainerProps = {
  children: (width: number, height: number) => ReactElement
  className?: string
}

export function ChartContainer({ children, className = '' }: ChartContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        setSize({ width, height })
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`select-none [&_svg]:outline-none [-webkit-tap-highlight-color:transparent] ${className}`}>
      {size && children(size.width, size.height)}
    </div>
  )
}
