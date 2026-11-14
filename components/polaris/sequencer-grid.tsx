'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { type LaneId, STEPS, type Track } from '@/lib/polaris/track'

const LANE_STYLE: Record<LaneId, { on: string; text: string }> = {
  lead: { on: 'bg-cyan-400', text: 'text-cyan-300' },
  pad: { on: 'bg-emerald-400', text: 'text-emerald-300' },
  bass: { on: 'bg-amber-400', text: 'text-amber-300' },
  pulse: { on: 'bg-slate-200', text: 'text-slate-300' },
}

const EMPTY_LANES: { id: LaneId; label: string; mapping: string }[] = [
  { id: 'lead', label: 'Lead', mapping: 'column value → pitch' },
  { id: 'pad', label: 'Pad', mapping: 'window mean → chord' },
  { id: 'bass', label: 'Bass', mapping: 'quadrant mean → root' },
  { id: 'pulse', label: 'Pulse', mapping: 'spatial gradient → hit' },
]

interface SequencerGridProps {
  track: Track | null
  getPlayhead: () => number | null
  onToggleStep: (lane: number, step: number) => void
}

export function SequencerGrid({ track, getPlayhead, onToggleStep }: SequencerGridProps) {
  const lineRef = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState(-1)
  const activeRef = useRef(-1)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const ph = getPlayhead()
      const line = lineRef.current
      if (line) {
        line.style.opacity = ph === null ? '0' : '1'
        line.style.left = `${((ph ?? 0) / STEPS) * 100}%`
      }
      const step = ph === null ? -1 : Math.floor(ph) % STEPS
      if (step !== activeRef.current) {
        activeRef.current = step
        setActiveStep(step)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [getPlayhead])

  const lanes = track?.lanes ?? EMPTY_LANES

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center gap-2 pl-24 sm:pl-32">
        <div className="grid flex-1 grid-cols-16 gap-1 font-mono text-[9px] text-slate-600 tabular-nums">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={cn('text-center', i === activeStep && 'text-cyan-300', i % 4 === 0 && 'text-slate-400')}>
              {String(i + 1).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>

      <div className="relative flex flex-col gap-1.5">
      {lanes.map((lane, li) => {
        const style = LANE_STYLE[lane.id]
        const steps = track?.lanes[li].steps
        return (
          <div key={lane.id} className="flex items-center gap-2">
            <div className="flex w-22 shrink-0 flex-col sm:w-30">
              <span className={cn('font-mono text-[11px] font-medium tracking-wider uppercase', style.text)}>{lane.label}</span>
              <span className="hidden truncate font-mono text-[9px] text-slate-500 sm:block">{lane.mapping}</span>
            </div>
            <div className="relative grid flex-1 grid-cols-16 gap-1">
              {Array.from({ length: STEPS }, (_, si) => {
                const step = steps?.[si]
                const on = !!step?.active
                const isNow = si === activeStep
                return (
                  <button
                    key={si}
                    type="button"
                    disabled={!track}
                    aria-pressed={on}
                    aria-label={`${lane.label} step ${si + 1}${on ? ', active' : ''}`}
                    onClick={() => onToggleStep(li, si)}
                    className={cn(
                      'relative h-6 rounded-[3px] border transition-[background-color,box-shadow,transform] duration-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed sm:h-7',
                      si % 4 === 0 ? 'border-zinc-700' : 'border-zinc-800',
                      on ? style.on : 'bg-zinc-900 hover:bg-zinc-800',
                      on && isNow && 'scale-y-110 shadow-[0_0_14px_2px_currentColor] brightness-125',
                      !on && isNow && 'bg-zinc-800',
                    )}
                    style={on ? { opacity: 0.35 + (step?.velocity ?? 0.5) * 0.65, color: 'rgba(255,255,255,0.35)' } : undefined}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 left-24 sm:left-32">
          <div
            ref={lineRef}
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-cyan-300 opacity-0 shadow-[0_0_12px_3px_rgba(34,211,238,0.75)]"
          />
        </div>
      </div>
    </div>
  )
}
