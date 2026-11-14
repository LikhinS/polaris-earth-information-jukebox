import { type Dataset, formatValue, toPhysical } from './datasets'
import { type DatasetTexture, textureIndex } from './texture'

export const STEPS = 16
export const RETICLE_PX = 256
const D2R = Math.PI / 180
const EARTH_RADIUS_KM = 6371

export interface ViewState {
  lon: number
  lat: number
  zoom: number
  /** Globe radius in CSS pixels, written by the renderer each frame. */
  radius: number
}

export type LaneId = 'lead' | 'pad' | 'bass' | 'pulse'

export interface Step {
  active: boolean
  velocity: number
  note: number
}

export interface Lane {
  id: LaneId
  label: string
  mapping: string
  steps: Step[]
}

export interface TrackStats {
  coverage: number
  mean: number | null
  min: number | null
  max: number | null
  gradients: number
  windowKm: number
}

export interface Track {
  id: number
  datasetId: Dataset['id']
  bpm: number
  scaleName: string
  lanes: Lane[]
  stats: TrackStats
  narration: string
  center: { lat: number; lon: number }
  zoom: number
}

/** Inverse orthographic projection. px/py are normalized to the globe radius, py points up. */
export function inverseOrtho(px: number, py: number, sinP: number, cosP: number, lam0: number) {
  const r2 = px * px + py * py
  if (r2 > 1) return null
  const z = Math.sqrt(1 - r2)
  const lat = Math.asin(py * cosP + z * sinP)
  const lon = lam0 + Math.atan2(px, z * cosP - py * sinP)
  return { lat, lon }
}

export function valueAt(texture: DatasetTexture, view: ViewState, dx: number, dy: number) {
  const sinP = Math.sin(view.lat * D2R)
  const cosP = Math.cos(view.lat * D2R)
  const hit = inverseOrtho(dx / view.radius, -dy / view.radius, sinP, cosP, view.lon * D2R)
  if (!hit) return null
  const v = texture.values[textureIndex(hit.lat, hit.lon)]
  return Number.isNaN(v) ? null : v
}

/** Samples a STEPS×STEPS grid of normalized values from the centered reticle window. */
export function sampleWindow(texture: DatasetTexture, view: ViewState) {
  const grid: (number | null)[][] = []
  for (let row = 0; row < STEPS; row++) {
    const cells: (number | null)[] = []
    for (let col = 0; col < STEPS; col++) {
      const dx = ((col + 0.5) / STEPS - 0.5) * RETICLE_PX
      const dy = ((row + 0.5) / STEPS - 0.5) * RETICLE_PX
      cells.push(valueAt(texture, view, dx, dy))
    }
    grid.push(cells)
  }
  return grid
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function std(xs: number[]) {
  const m = mean(xs)
  if (m === null || xs.length < 2) return 0
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}

function degreeToMidi(root: number, scale: number[], degree: number) {
  const octave = Math.floor(degree / scale.length)
  const idx = ((degree % scale.length) + scale.length) % scale.length
  return root + octave * 12 + scale[idx]
}

export function formatLat(lat: number) {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`
}

export function formatLon(lon: number) {
  let l = ((((lon + 180) % 360) + 360) % 360) - 180
  if (l === -180) l = 180
  return `${Math.abs(l).toFixed(1)}°${l >= 0 ? 'E' : 'W'}`
}

export function windowKm(view: ViewState) {
  const angular = Math.min(2, RETICLE_PX / view.radius)
  return angular * EARTH_RADIUS_KM
}

export function generateTrack(ds: Dataset, grid: (number | null)[][], view: ViewState, id: number): Track {
  const { scale, root, bpm, scaleName } = ds.music
  const columns = Array.from({ length: STEPS }, (_, c) =>
    grid.map((row) => row[c]).filter((v): v is number => v !== null),
  )
  const colMeans = columns.map(mean)
  const all = columns.flat()
  const globalMean = mean(all)
  const coverage = all.length / (STEPS * STEPS)

  const gradients = colMeans.map((m, c) => {
    if (c === 0) return 0
    const prev = colMeans[c - 1]
    if (m === null && prev === null) return 0
    if (m === null || prev === null) return 0.5
    return Math.abs(m - prev)
  })
  const sorted = [...gradients].sort((a, b) => b - a)
  const gradThreshold = Math.max(0.02, sorted[5] ?? 0)
  const gradientSteps = gradients.map((g) => g >= gradThreshold && g > 0.02)

  const lead: Step[] = colMeans.map((m, c) => {
    if (m === null) return { active: false, velocity: 0, note: root }
    const prev = colMeans[c - 1]
    const changed = prev === null || prev === undefined || Math.abs(m - prev) > 0.025
    const spread = std(columns[c])
    return {
      active: c % 2 === 0 || changed || spread > 0.06,
      velocity: Math.min(1, 0.45 + m * 0.4 + spread * 2),
      note: degreeToMidi(root + 12, scale, Math.round(m * scale.length * 2)),
    }
  })

  const padNote = degreeToMidi(root, scale, Math.round((globalMean ?? 0.5) * scale.length))
  const pad: Step[] = Array.from({ length: STEPS }, (_, c) => ({
    active: globalMean !== null && (c === 0 || c === 8),
    velocity: 0.55 + coverage * 0.3,
    note: c === 8 ? degreeToMidi(root, scale, Math.round((globalMean ?? 0.5) * scale.length) + 2) : padNote,
  }))

  const bass: Step[] = Array.from({ length: STEPS }, (_, c) => {
    const q = Math.floor(c / 4) * 4
    const quad = columns.slice(q, q + 4).flat()
    const qm = mean(quad)
    if (qm === null) return { active: false, velocity: 0, note: root - 12 }
    const qMax = Math.max(...quad)
    return {
      active: c % 4 === 0 || (c % 4 === 3 && qMax > 0.72),
      velocity: c % 4 === 0 ? 0.85 : 0.55,
      note: degreeToMidi(root - 12, scale, Math.round(qm * (scale.length - 1))),
    }
  })

  const pulse: Step[] = gradientSteps.map((hit, c) => ({
    active: hit || (coverage > 0 && c % 4 === 2),
    velocity: hit ? Math.min(1, 0.6 + gradients[c] * 2) : 0.28,
    note: 0,
  }))

  const lanes: Lane[] = [
    { id: 'lead', label: 'Lead', mapping: 'column value → pitch', steps: lead },
    { id: 'pad', label: 'Pad', mapping: 'window mean → chord', steps: pad },
    { id: 'bass', label: 'Bass', mapping: 'quadrant mean → root', steps: bass },
    { id: 'pulse', label: 'Pulse', mapping: 'spatial gradient → hit', steps: pulse },
  ]

  const km = windowKm(view)
  const stats: TrackStats = {
    coverage,
    mean: globalMean === null ? null : toPhysical(ds, globalMean),
    min: all.length ? toPhysical(ds, Math.min(...all)) : null,
    max: all.length ? toPhysical(ds, Math.max(...all)) : null,
    gradients: gradientSteps.filter(Boolean).length,
    windowKm: km,
  }

  return {
    id,
    datasetId: ds.id,
    bpm,
    scaleName,
    lanes,
    stats,
    narration: buildNarration(ds, stats, view, bpm, scaleName),
    center: { lat: view.lat, lon: view.lon },
    zoom: view.zoom,
  }
}

function buildNarration(ds: Dataset, s: TrackStats, view: ViewState, bpm: number, scaleName: string) {
  const where = `${formatLat(view.lat)}, ${formatLon(view.lon)}`
  const extent =
    s.windowKm >= 12000 ? 'a full hemisphere' : `roughly ${Math.round(s.windowKm).toLocaleString('en-US')} kilometres across`
  const intro = `Track generated from ${ds.name}, ${ds.code}. The sample window is centred at ${where}, covering ${extent} at ${view.zoom.toFixed(1)} times zoom.`
  if (s.mean === null || s.min === null || s.max === null) {
    const reason = ds.landIsNoData ? 'the window sits over land or open space, where this variable is undefined' : 'the window is outside the globe'
    return `${intro} No valid ${ds.variable.replaceAll('_', ' ')} samples were found because ${reason}. Only an ambient bed is produced. Move the reticle over the ocean and generate again.`
  }
  const u = ds.unit
  const body = `${Math.round(s.coverage * 100)} percent of the window contains valid data. Mean ${ds.variable.replaceAll('_', ' ')} is ${formatValue(ds, s.mean)} ${u}, ranging from ${formatValue(ds, s.min)} to ${formatValue(ds, s.max)} ${u}. ${ds.interpret(s.mean)}`
  const music = `Listening guide: the lead melody reads the window from west to east, and higher pitch means ${ds.higherMeans}. The bass follows each quarter of the window, and ${s.gradients} percussive pulses mark sharp spatial gradients or coastlines. Tempo ${bpm} beats per minute in ${scaleName}.`
  return `${intro} ${body} ${music}`
}
