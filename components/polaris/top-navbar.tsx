'use client'

import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import type { TransportStatus } from '@/hooks/use-sonification'

function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 1000)
  return () => window.clearInterval(id)
}
const getClock = () => new Date().toISOString().slice(11, 19)

export function TopNavbar({ audioStatus }: { audioStatus: TransportStatus }) {
  const utc = useSyncExternalStore(subscribeClock, getClock, () => '--:--:--')
  const audioLabel = audioStatus === 'playing' ? 'STREAMING' : audioStatus === 'paused' ? 'PAUSED' : 'STANDBY'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <div
          role="img"
          aria-label="NASA Space Apps Challenge 2026"
          className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 py-1 pr-3 pl-1"
        >
          <span className="grid size-7 place-items-center rounded-full bg-[#0b3d91] text-[9px] font-black tracking-tight text-white italic ring-1 ring-red-500/70">
            NASA
          </span>
          <span className="hidden font-mono text-[10px] leading-tight text-slate-400 sm:block">
            SPACE APPS
            <br />
            <span className="text-slate-200">2026</span>
          </span>
        </div>
        <h1 className="truncate text-sm font-semibold tracking-wide text-slate-100 sm:text-base">
          <span className="text-cyan-300">POLARIS</span>
          <span className="px-2 text-slate-600">{'//'}</span>
          <span className="font-normal text-slate-300">Earth Information Jukebox</span>
        </h1>
      </div>

      <div className="flex items-center gap-4 font-mono text-[10px] tracking-widest">
        <span className="hidden items-center gap-2 text-slate-400 md:flex">
          AUDIO
          <span className={cn(audioStatus === 'playing' ? 'text-amber-300' : 'text-slate-300')}>{audioLabel}</span>
        </span>
        <span className="hidden items-center gap-2 text-slate-400 md:flex">
          UTC <span className="text-slate-200 tabular-nums">{utc}</span>
        </span>
        <span
          role="status"
          className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          SYSTEM ONLINE
        </span>
      </div>
    </header>
  )
}
