'use client'

import { type KeyboardEvent, useRef } from 'react'
import { Flame, Leaf, type LucideIcon, Snowflake, Thermometer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DATASETS, type DatasetId } from '@/lib/polaris/datasets'
import { PaletteBar } from './palette-bar'

const ICONS: Record<DatasetId, LucideIcon> = {
  sst: Thermometer,
  co2: Leaf,
  aerosol: Flame,
  seaice: Snowflake,
}

interface DatasetSidebarProps {
  selected: DatasetId
  onSelect: (id: DatasetId) => void
}

export function DatasetSidebar({ selected, onSelect }: DatasetSidebarProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKey = (e: KeyboardEvent, index: number) => {
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (index + dir + DATASETS.length) % DATASETS.length
    onSelect(DATASETS[next].id)
    refs.current[next]?.focus()
  }

  return (
    <aside
      aria-label="Dataset registry"
      className="flex shrink-0 flex-col border-zinc-800 bg-zinc-950 lg:w-80 lg:border-r"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="font-mono text-[11px] tracking-[0.22em] text-slate-400 uppercase">Dataset Registry</h2>
        <span className="font-mono text-[10px] text-slate-500">{DATASETS.length} STREAMS</span>
      </div>
      <div
        role="radiogroup"
        aria-label="Select a dataset"
        className="grid gap-2.5 p-3 sm:grid-cols-2 lg:flex lg:flex-1 lg:flex-col lg:overflow-y-auto"
      >
        {DATASETS.map((ds, i) => {
          const Icon = ICONS[ds.id]
          const active = ds.id === selected
          return (
            <button
              key={ds.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(ds.id)}
              onKeyDown={(e) => handleKey(e, i)}
              className={cn(
                'group flex flex-col gap-2.5 rounded-lg border p-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
                active
                  ? cn(ds.accent.border, ds.accent.bg, ds.accent.glow)
                  : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-md border',
                    active ? cn(ds.accent.border, ds.accent.text) : 'border-zinc-700 text-slate-400',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn('text-sm font-semibold', active ? 'text-slate-50' : 'text-slate-200')}>{ds.name}</span>
                    {active && (
                      <span className={cn('font-mono text-[9px] tracking-widest', ds.accent.text)}>LOADED</span>
                    )}
                  </span>
                  <span className="truncate font-mono text-[10px] text-slate-500">{ds.code}</span>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
                <dt className="text-slate-500">SOURCE</dt>
                <dd className="truncate text-right text-slate-300">{ds.source}</dd>
                <dt className="text-slate-500">SENSOR</dt>
                <dd className="truncate text-right text-slate-300">{ds.instrument}</dd>
                <dt className="text-slate-500">SAMPLING</dt>
                <dd className="truncate text-right text-slate-300">
                  {ds.resolution} · {ds.cadence}
                </dd>
              </dl>

              <div className="flex flex-col gap-1.5 border-t border-zinc-800 pt-2">
                <span className="flex justify-between font-mono text-[10px]">
                  <span className={active ? ds.accent.text : 'text-slate-400'}>{ds.variable}</span>
                  <span className="text-slate-500">{ds.unit}</span>
                </span>
                <PaletteBar dataset={ds} />
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
