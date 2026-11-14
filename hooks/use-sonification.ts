'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { STEPS, type Track } from '@/lib/polaris/track'

export type TransportStatus = 'idle' | 'playing' | 'paused'

interface Engine {
  ctx: AudioContext
  master: GainNode
  send: GainNode
  noise: AudioBuffer
}

const LOOKAHEAD_S = 0.12
const TICK_MS = 25

const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12)

function createEngine(): Engine {
  const ctx = new AudioContext()
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -18
  compressor.ratio.value = 4
  compressor.connect(ctx.destination)

  const master = ctx.createGain()
  master.gain.value = 0.7
  master.connect(compressor)

  const delay = ctx.createDelay(1)
  delay.delayTime.value = 0.28
  const feedback = ctx.createGain()
  feedback.gain.value = 0.32
  const wet = ctx.createGain()
  wet.gain.value = 0.3
  const send = ctx.createGain()
  send.connect(delay)
  delay.connect(feedback)
  feedback.connect(delay)
  delay.connect(wet)
  wet.connect(master)

  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  return { ctx, master, send, noise }
}

function envelope(ctx: AudioContext, time: number, peak: number, attack: number, dur: number) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, time)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  return g
}

function playVoice(engine: Engine, lane: Track['lanes'][number], step: number, time: number, stepDur: number) {
  const s = lane.steps[step]
  if (!s?.active) return
  const { ctx, master, send } = engine

  if (lane.id === 'pulse') {
    const src = ctx.createBufferSource()
    src.buffer = engine.noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'highpass'
    bp.frequency.value = 6500
    const g = envelope(ctx, time, 0.35 * s.velocity, 0.002, 0.06)
    src.connect(bp).connect(g).connect(master)
    src.start(time)
    src.stop(time + 0.08)
    return
  }

  const freq = midiToFreq(s.note)
  if (lane.id === 'lead') {
    const dur = stepDur * 1.4
    const g = envelope(ctx, time, 0.16 * s.velocity, 0.01, dur)
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const shimmer = ctx.createOscillator()
    shimmer.type = 'sine'
    shimmer.frequency.value = freq * 2
    const sg = ctx.createGain()
    sg.gain.value = 0.25
    osc.connect(g)
    shimmer.connect(sg).connect(g)
    g.connect(master)
    g.connect(send)
    osc.start(time)
    shimmer.start(time)
    osc.stop(time + dur + 0.05)
    shimmer.stop(time + dur + 0.05)
    return
  }

  if (lane.id === 'bass') {
    const dur = stepDur * 2.2
    const g = envelope(ctx, time, 0.22 * s.velocity, 0.008, dur)
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900, time)
    lp.frequency.exponentialRampToValueAtTime(180, time + dur)
    osc.connect(lp).connect(g).connect(master)
    osc.start(time)
    osc.stop(time + dur + 0.05)
    return
  }

  const dur = stepDur * 7.5
  const g = envelope(ctx, time, 0.07 * s.velocity, 0.35, dur)
  for (const ratio of [1, 1.5, 2.003]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq * ratio
    osc.detune.value = ratio === 1 ? -6 : 6
    osc.connect(g)
    osc.start(time)
    osc.stop(time + dur + 0.1)
  }
  g.connect(master)
  g.connect(send)
}

export function useSonification(track: Track | null) {
  const [status, setStatus] = useState<TransportStatus>('idle')
  const statusRef = useRef<TransportStatus>('idle')
  const trackRef = useRef(track)
  const engineRef = useRef<Engine | null>(null)
  const timerRef = useRef<number | null>(null)
  const nextStepRef = useRef(0)
  const nextTimeRef = useRef(0)
  const pausedStepRef = useRef(0)
  const queueRef = useRef<{ step: number; time: number; dur: number }[]>([])

  useEffect(() => {
    trackRef.current = track
  }, [track])

  const updateStatus = useCallback((s: TransportStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const getPlayhead = useCallback((): number | null => {
    if (statusRef.current === 'paused') return pausedStepRef.current
    if (statusRef.current !== 'playing' || !engineRef.current) return null
    const now = engineRef.current.ctx.currentTime
    const queue = queueRef.current
    let current = queue[0]
    for (const entry of queue) {
      if (entry.time <= now) current = entry
      else break
    }
    if (!current || current.time > now) return current ? current.step : 0
    return current.step + Math.min(0.999, (now - current.time) / current.dur)
  }, [])

  const tick = useCallback(() => {
    const engine = engineRef.current
    const t = trackRef.current
    if (!engine || !t) return
    const stepDur = 60 / t.bpm / 4
    while (nextTimeRef.current < engine.ctx.currentTime + LOOKAHEAD_S) {
      const step = nextStepRef.current % STEPS
      for (const lane of t.lanes) playVoice(engine, lane, step, nextTimeRef.current, stepDur)
      queueRef.current.push({ step, time: nextTimeRef.current, dur: stepDur })
      nextTimeRef.current += stepDur
      nextStepRef.current = step + 1
    }
    const now = engine.ctx.currentTime
    while (queueRef.current.length > 2 && queueRef.current[1].time < now) queueRef.current.shift()
  }, [])

  const play = useCallback(async () => {
    if (!trackRef.current || statusRef.current === 'playing') return
    if (!engineRef.current) engineRef.current = createEngine()
    const engine = engineRef.current
    if (engine.ctx.state === 'suspended') await engine.ctx.resume()
    nextStepRef.current = pausedStepRef.current
    nextTimeRef.current = engine.ctx.currentTime + 0.06
    queueRef.current = []
    updateStatus('playing')
    tick()
    clearTimer()
    timerRef.current = window.setInterval(tick, TICK_MS)
  }, [clearTimer, tick, updateStatus])

  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return
    const ph = getPlayhead() ?? 0
    clearTimer()
    pausedStepRef.current = (Math.floor(ph) + 1) % STEPS
    updateStatus('paused')
  }, [clearTimer, getPlayhead, updateStatus])

  const replay = useCallback(() => {
    clearTimer()
    pausedStepRef.current = 0
    statusRef.current = 'idle'
    void play()
  }, [clearTimer, play])

  const setDucked = useCallback((ducked: boolean) => {
    const engine = engineRef.current
    if (!engine) return
    engine.master.gain.setTargetAtTime(ducked ? 0.18 : 0.7, engine.ctx.currentTime, 0.15)
  }, [])

  useEffect(
    () => () => {
      clearTimer()
      void engineRef.current?.ctx.close()
    },
    [clearTimer],
  )

  return { status, play, pause, replay, getPlayhead, setDucked }
}
