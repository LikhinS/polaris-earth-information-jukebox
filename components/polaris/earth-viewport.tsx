'use client'

import { type RefObject, useCallback, useState } from 'react'
import { Minus, Orbit, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Dataset, formatValue, toPhysical } from '@/lib/polaris/datasets'
import type { DatasetTexture } from '@/lib/polaris/texture'
import { RETICLE_PX, type ViewState, formatLat, formatLon, valueAt, windowKm } from '@/lib/polaris/track'
import { EarthCanvas, ZOOM_MAX, ZOOM_MIN } from './earth-canvas'
import { PaletteBar } from './palette-bar'

interface EarthViewportProps {
  dataset: Dataset
  texture: DatasetTexture | null
  viewRef: RefObject<ViewState>
  zoom: number
  onZoomChange: (zoom: number) => void
  autoOrbit: boolean
  onAutoOrbitChange: (on: boolean) => void
  scanning: boolean
  onResetView: () => void
}

interface HudState {
  lat: number
  lon: number
  km: number
  value: number | null
}

export function EarthViewport({
  dataset,
  texture,
  viewRef,
  zoom,
  onZoomChange,
  autoOrbit,
  onAutoOrbitChange,
  scanning,
  onResetView,
}: EarthViewportProps) {
  const [hud, setHud] = useState<HudState>({ lat: 0, lon: 0, km: 0, value: null })

  const handleViewTick = useCallback(
    (view: ViewState) => {
      const value = texture ? valueAt(texture, view, 0, 0) : null
      setHud({ lat: view.lat, lon: view.lon, km: windowKm(view), value })
    },
    [texture],
  )
  const handleUserRotate = useCallback(() => onAutoOrbitChange(false), [onAutoOrbitChange])

  const zoomStep = (delta: number) =>
    onZoomChange(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((zoom + delta) * 10) / 10)))

  return (
    <section
      aria-label="Earth visualization viewport"
      className="starfield relative min-h-[420px] flex-1 overflow-hidden border-zinc-800 bg-slate-950 lg:min-h-0"
    >
      <EarthCanvas
        texture={texture}
        zoom={zoom}
        autoOrbit={autoOrbit}
        viewRef={viewRef}
        onZoomChange={onZoomChange}
        onUserRotate={handleUserRotate}
        onViewTick={handleViewTick}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: RETICLE_PX, height: RETICLE_PX }}
      >
        <div className="absolute inset-0 border border-cyan-300/25 bg-cyan-300/[0.03]" />
        {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'right-0 bottom-0 border-r-2 border-b-2'].map(
          (pos) => (
            <span key={pos} className={cn('absolute size-5 border-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]', pos)} />
          ),
        )}
        <span className="absolute top-1/2 left-1/2 h-px w-6 -translate-x-1/2 bg-cyan-300/80" />
        <span className="absolute top-1/2 left-1/2 h-6 w-px -translate-y-1/2 bg-cyan-300/80" />
        <span className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200" />
        {scanning && <span className="animate-reticle-scan absolute inset-x-0 h-0.5 bg-cyan-300 shadow-[0_0_14px_2px_rgba(34,211,238,0.8)]" />}
        <span className="absolute -top-6 left-0 font-mono text-[10px] tracking-[0.2em] text-cyan-300/90 uppercase">
          {scanning ? 'Sampling…' : 'Sample window · 256×256 px'}
        </span>
        <span className="absolute -bottom-6 right-0 font-mono text-[10px] tracking-widest text-cyan-300/70">
          {hud.km >= 12000 ? '≈ HEMISPHERE' : `≈ ${Math.round(hud.km).toLocaleString('en-US')} KM`}
        </span>
      </div>

      <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-1 font-mono text-[11px] text-slate-400">
        <span className="tracking-[0.2em] text-slate-500 uppercase">Viewport // Orthographic</span>
        <span className={cn('text-sm font-medium tracking-wide', dataset.accent.text)}>{dataset.name}</span>
        <span>
          CTR <span className="text-slate-200 tabular-nums">{formatLat(hud.lat)}</span>{' '}
          <span className="text-slate-200 tabular-nums">{formatLon(hud.lon)}</span>
        </span>
        <span>
          VAL{' '}
          <span className="text-slate-200 tabular-nums">
            {hud.value === null ? 'NO DATA' : `${formatValue(dataset, toPhysical(dataset, hud.value))} ${dataset.unit}`}
          </span>
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 hidden w-56 flex-col gap-1.5 rounded-md border border-zinc-800/80 bg-zinc-950/70 p-3 backdrop-blur sm:flex">
        <span className="font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase">{dataset.variable}</span>
        <PaletteBar dataset={dataset} />
        <span className="font-mono text-[10px] text-slate-500">Drag to rotate · Scroll to zoom</span>
      </div>

      <div className="absolute right-4 bottom-4 flex items-center gap-2 rounded-md border border-zinc-800/80 bg-zinc-950/80 p-1.5 backdrop-blur">
        <button
          type="button"
          onClick={() => onAutoOrbitChange(!autoOrbit)}
          aria-pressed={autoOrbit}
          aria-label="Toggle auto orbit"
          className={cn(
            'grid size-8 place-items-center rounded transition-colors hover:bg-zinc-800',
            autoOrbit ? 'text-emerald-300' : 'text-slate-400',
          )}
        >
          <Orbit className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onResetView}
          aria-label="Reset view"
          className="grid size-8 place-items-center rounded text-slate-400 transition-colors hover:bg-zinc-800 hover:text-slate-200"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </button>
        <span className="h-5 w-px bg-zinc-800" />
        <button
          type="button"
          onClick={() => zoomStep(-0.5)}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Zoom out"
          className="grid size-8 place-items-center rounded text-slate-300 transition-colors hover:bg-zinc-800 disabled:opacity-30"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <label className="flex items-center">
          <span className="sr-only">Zoom level</span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.1}
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="zoom-slider w-24 sm:w-32"
          />
        </label>
        <button
          type="button"
          onClick={() => zoomStep(0.5)}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Zoom in"
          className="grid size-8 place-items-center rounded text-slate-300 transition-colors hover:bg-zinc-800 disabled:opacity-30"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <output className="w-12 pr-1 text-right font-mono text-xs text-cyan-300 tabular-nums" aria-live="polite">
          {zoom.toFixed(1)}×
        </output>
      </div>
    </section>
  )
}
