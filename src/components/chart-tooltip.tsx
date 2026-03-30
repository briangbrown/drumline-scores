type TooltipPayloadEntry = {
  dataKey?: string | number
  name?: string
  value?: number | string
  color?: string
}

type ChartTooltipProps = {
  active?: boolean
  payload?: Array<TooltipPayloadEntry>
  label?: string
}

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-text-secondary">{label}</p>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-text-secondary">{entry.name}:</span>
          <span className="font-medium text-text-primary">
            {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}
