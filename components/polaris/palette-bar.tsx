import type { Dataset } from '@/lib/polaris/datasets'

export function PaletteBar({ dataset }: { dataset: Dataset }) {
  const mid = (dataset.min + dataset.max) / 2
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-2 w-full rounded-sm ring-1 ring-white/10"
        style={{ background: `linear-gradient(90deg, ${dataset.palette.join(', ')})` }}
        role="img"
        aria-label={`Color scale from ${dataset.min} to ${dataset.max} ${dataset.unit}`}
      />
      <div className="flex justify-between font-mono text-[10px] text-slate-400 tabular-nums">
        <span>{dataset.min}</span>
        <span>
          {mid} {dataset.unit}
        </span>
        <span>{dataset.min < 0 ? `+${dataset.max}` : dataset.max}</span>
      </div>
    </div>
  )
}
