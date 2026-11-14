'use client'

import { AudioWaveform, Loader2, Pause, Play, RotateCcw, Square, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Dataset } from '@/lib/polaris/datasets'
import type { Track } from '@/lib/polaris/track'
import type { TransportStatus } from '@/hooks/use-sonification'
import { SequencerGrid } from './sequencer-grid'

interface DawPanelProps {
  dataset: Dataset
  track: Track | null
  generating: boolean
  status: TransportStatus
  getPlayhead: () => number | null
  onGenerate: () => void
  onPlay: () => void
  onPause: () => void
  onReplay: () => void
  onToggleStep: (lane: number, step: number) => void
  speech: { supported: boolean; speaking: boolean; speak: (t: string) => void; stop: () => void }
  autoNarrate: boolean
  onAutoNarrateChange: (on: boolean) => void
}

const transportBtn =
  'grid size-10 place-items-center rounded-md border border-zinc-700 bg-zinc-900 text-slate-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-cyan-400 outline-none'

export function DawPanel({
  dataset,
  track,
  generating,
  status,
  getPlayhead,
  onGenerate,
  onPlay,
  onPause,
  onReplay,
  onToggleStep,
  speech,
  autoNarrate,
  onAutoNarrateChange,
}: DawPanelProps) {
  const stale = track && track.datasetId !== dataset.id

  return (
    <section
      aria-label="Sonification workstation"
      className="grid shrink-0 gap-4 border-t border-zinc-800 bg-zinc-950 p-4 lg:grid-cols-[12rem_minmax(0,1fr)_20rem]"
    >
      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] tracking-[0.22em] text-slate-400 uppercase">Transport</h2>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-400 px-4 text-sm font-semibold text-slate-950 shadow-[0_0_24px_-4px_rgba(34,211,238,0.7)] transition-colors outline-none hover:bg-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-70"
        >
          {generating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <AudioWaveform className="size-4" aria-hidden="true" />}
          {generating ? 'Sampling…' : 'Generate Track'}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onPlay} disabled={!track || status === 'playing'} aria-label="Play" className={cn(transportBtn, status === 'playing' && 'border-emerald-500/60 text-emerald-300')}>
            <Play className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onPause} disabled={status !== 'playing'} aria-label="Pause" className={cn(transportBtn, status === 'paused' && 'border-amber-500/60 text-amber-300')}>
            <Pause className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onReplay} disabled={!track} aria-label="Replay from start" className={transportBtn}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-md border border-zinc-800 bg-zinc-900/50 p-2 font-mono text-[10px]">
          <dt className="text-slate-500">TEMPO</dt>
          <dd className="text-right text-slate-200 tabular-nums">{track ? `${track.bpm} BPM` : '—'}</dd>
          <dt className="text-slate-500">MODE</dt>
          <dd className="truncate text-right text-slate-200">{track?.scaleName ?? '—'}</dd>
          <dt className="text-slate-500">STATE</dt>
          <dd
            className={cn(
              'text-right uppercase',
              status === 'playing' ? 'text-emerald-300' : status === 'paused' ? 'text-amber-300' : 'text-slate-400',
            )}
          >
            {status}
          </dd>
        </dl>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mono text-[11px] tracking-[0.22em] text-slate-400 uppercase">16-Step Sequencer</h2>
          {stale ? (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
              SOURCE CHANGED · REGENERATE
            </span>
          ) : track ? (
            <span className="font-mono text-[10px] text-slate-500">
              TRK-{String(track.id).padStart(3, '0')} · {Math.round(track.stats.coverage * 100)}% COVERAGE
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[440px]">
            <SequencerGrid track={track} getPlayhead={getPlayhead} onToggleStep={onToggleStep} />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="narration-heading" className="font-mono text-[11px] tracking-[0.22em] text-slate-400 uppercase">
            Scientific Narration
          </h2>
          <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-slate-400">
            <input
              type="checkbox"
              checked={autoNarrate}
              onChange={(e) => onAutoNarrateChange(e.target.checked)}
              className="size-3 accent-cyan-400"
            />
            AUTO-SPEAK
          </label>
        </div>
        <div
          aria-labelledby="narration-heading"
          aria-live="polite"
          className="h-32 overflow-y-auto rounded-md border border-zinc-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300 lg:h-[7.5rem]"
        >
          {track ? track.narration : 'Position the reticle over a region of interest and press Generate Track. A plain-language description of the data and how it maps to sound will appear here.'}
        </div>
        <button
          type="button"
          onClick={() => (speech.speaking ? speech.stop() : track && speech.speak(track.narration))}
          disabled={!speech.supported || !track}
          className={cn(
            'flex h-9 items-center justify-center gap-2 rounded-md border text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-40',
            speech.speaking
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
              : 'border-zinc-700 bg-zinc-900 text-slate-200 hover:bg-zinc-800',
          )}
        >
          {speech.speaking ? <Square className="size-3.5" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
          {speech.supported ? (speech.speaking ? 'Stop narration' : 'Read aloud') : 'Text-to-speech unavailable'}
        </button>
      </div>
    </section>
  )
}
