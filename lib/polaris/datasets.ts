import { blob, clamp01, smoothstep, sphereNoise } from './noise'

export type DatasetId = 'sst' | 'co2' | 'aerosol' | 'seaice'

export interface DatasetAccent {
  text: string
  border: string
  bg: string
  glow: string
  hex: string
}

export interface MusicProfile {
  scaleName: string
  scale: number[]
  root: number
  rootName: string
  bpm: number
}

export interface Dataset {
  id: DatasetId
  name: string
  code: string
  source: string
  instrument: string
  resolution: string
  cadence: string
  variable: string
  unit: string
  min: number
  max: number
  decimals: number
  palette: string[]
  landIsNoData: boolean
  description: string
  higherMeans: string
  accent: DatasetAccent
  music: MusicProfile
  /** Returns a normalized value 0..1, or NaN where the variable is undefined. */
  field: (lat: number, lon: number, land: boolean) => number
  interpret: (mean: number) => string
}

export const DATASETS: Dataset[] = [
  {
    id: 'sst',
    name: 'SST Anomaly',
    code: 'GHRSST-MUR-L4',
    source: 'NASA JPL PO.DAAC',
    instrument: 'MODIS · AMSR2 · VIIRS blend',
    resolution: '0.01° grid',
    cadence: 'Daily',
    variable: 'sst_anomaly',
    unit: '°C',
    min: -3,
    max: 3,
    decimals: 2,
    palette: ['#1e3a8a', '#0891b2', '#e2e8f0', '#f59e0b', '#dc2626'],
    landIsNoData: true,
    description: 'Departure of sea surface temperature from the 2003–2014 climatological mean.',
    higherMeans: 'warmer-than-normal ocean water',
    accent: {
      text: 'text-cyan-300',
      border: 'border-cyan-400/60',
      bg: 'bg-cyan-400/10',
      glow: 'shadow-[0_0_24px_-6px_rgba(34,211,238,0.55)]',
      hex: '#22d3ee',
    },
    music: { scaleName: 'A minor pentatonic', scale: [0, 3, 5, 7, 10], root: 57, rootName: 'A', bpm: 96 },
    field: (lat, lon, land) => {
      if (land) return Number.NaN
      const anomaly =
        1.9 * blob(lat, lon, 0, -118, 7, 32) +
        1.3 * blob(lat, lon, 46, -38, 9, 18) +
        1.0 * blob(lat, lon, 38, 158, 7, 22) -
        1.2 * blob(lat, lon, -52, 10, 7, 55) -
        0.8 * blob(lat, lon, -8, 75, 9, 20) +
        (sphereNoise(lat, lon, 3.2, 17, 4) - 0.5) * 3.2
      return clamp01((anomaly + 3) / 6)
    },
    interpret: (m) =>
      m > 0.75
        ? 'The window is markedly warmer than its climatological baseline, consistent with marine heatwave conditions.'
        : m > 0.2
          ? 'Surface waters are running moderately warm relative to the long-term mean.'
          : m < -0.75
            ? 'Strong cold anomalies dominate, suggesting upwelling or a cold-tongue pattern.'
            : m < -0.2
              ? 'Waters are slightly cooler than the climatological mean.'
              : 'Temperatures sit close to the long-term baseline with small local departures.',
  },
  {
    id: 'co2',
    name: 'CO₂ Flux',
    code: 'OCO-2-L4-MIP',
    source: 'NASA GES DISC',
    instrument: 'OCO-2 grating spectrometer',
    resolution: '1° × 1° grid',
    cadence: 'Monthly',
    variable: 'net_co2_flux',
    unit: 'gC/m²/d',
    min: -4,
    max: 4,
    decimals: 2,
    palette: ['#047857', '#34d399', '#334155', '#fbbf24', '#f97316'],
    landIsNoData: false,
    description: 'Net surface–atmosphere carbon exchange. Negative values are sinks, positive are sources.',
    higherMeans: 'net carbon release to the atmosphere',
    accent: {
      text: 'text-emerald-300',
      border: 'border-emerald-400/60',
      bg: 'bg-emerald-400/10',
      glow: 'shadow-[0_0_24px_-6px_rgba(52,211,153,0.55)]',
      hex: '#34d399',
    },
    music: { scaleName: 'D dorian', scale: [0, 2, 3, 5, 7, 9, 10], root: 50, rootName: 'D', bpm: 104 },
    field: (lat, lon, land) => {
      const n = (sphereNoise(lat, lon, 4.1, 29, 3) - 0.5) * 2.4
      let flux: number
      if (land) {
        flux =
          -2.4 * blob(lat, lon, 58, 90, 9, 70) -
          2.2 * blob(lat, lon, -4, -62, 9, 14) -
          1.8 * blob(lat, lon, 0, 22, 8, 12) -
          1.4 * blob(lat, lon, 55, -100, 8, 30) +
          3.2 * blob(lat, lon, 34, 114, 7, 12) +
          2.4 * blob(lat, lon, 48, 8, 5, 14) +
          2.4 * blob(lat, lon, 39, -84, 6, 14) +
          1.6 * blob(lat, lon, 24, 78, 6, 10) +
          n
      } else {
        flux =
          -1.8 * blob(lat, lon, -50, 0, 7, 200) -
          1.2 * blob(lat, lon, 45, -30, 8, 30) +
          1.6 * blob(lat, lon, 0, -125, 5, 45) +
          n * 0.5
      }
      return clamp01((flux + 4) / 8)
    },
    interpret: (m) =>
      m < -1
        ? 'This region acts as a strong carbon sink, drawing CO₂ out of the atmosphere.'
        : m < -0.2
          ? 'A modest net uptake of carbon is detected across the window.'
          : m > 1
            ? 'The region is a strong net carbon source, consistent with industrial or fire emissions.'
            : m > 0.2
              ? 'Slight net outgassing of carbon dominates the sampled area.'
              : 'Sources and sinks are nearly balanced across the sampled area.',
  },
  {
    id: 'aerosol',
    name: 'Wildfire Aerosol',
    code: 'MCD19A2-MAIAC',
    source: 'NASA LAADS DAAC',
    instrument: 'MODIS Terra + Aqua',
    resolution: '1 km swath',
    cadence: 'Daily',
    variable: 'aerosol_optical_depth',
    unit: 'AOD 550nm',
    min: 0,
    max: 2,
    decimals: 2,
    palette: ['#0c0a09', '#78350f', '#f59e0b', '#fde68a', '#fff7ed'],
    landIsNoData: false,
    description: 'Columnar aerosol optical depth at 550 nm, dominated here by biomass-burning smoke.',
    higherMeans: 'denser smoke and particulate loading',
    accent: {
      text: 'text-amber-300',
      border: 'border-amber-400/60',
      bg: 'bg-amber-400/10',
      glow: 'shadow-[0_0_24px_-6px_rgba(251,191,36,0.55)]',
      hex: '#fbbf24',
    },
    music: { scaleName: 'E phrygian', scale: [0, 1, 3, 5, 7, 8, 10], root: 52, rootName: 'E', bpm: 88 },
    field: (lat, lon, land) => {
      const texture = 0.45 + sphereNoise(lat, lon, 6.5, 41, 4) * 1.1
      const fires =
        1.7 * blob(lat, lon, -9, 22, 7, 11) +
        1.3 * blob(lat, lon, -10, -58, 6, 9) +
        1.2 * blob(lat, lon, 62, 118, 5, 18) +
        1.0 * blob(lat, lon, 53, -118, 5, 9) +
        0.8 * blob(lat, lon, -27, 138, 5, 11) +
        0.7 * blob(lat, lon, 24, 82, 5, 9)
      const plumes =
        0.9 * blob(lat, lon, -11, -2, 6, 16) +
        0.5 * blob(lat, lon, 55, -140, 6, 16) +
        0.5 * blob(lat, lon, 60, 150, 6, 16)
      const aod = 0.08 + (land ? fires : fires * 0.6) * texture + plumes * texture
      return clamp01(aod / 2)
    },
    interpret: (m) =>
      m > 1
        ? 'Extremely heavy smoke loading indicates active large-scale fires nearby.'
        : m > 0.5
          ? 'Elevated aerosol levels point to drifting wildfire smoke plumes.'
          : m > 0.2
            ? 'Light haze is present, typical of background or distant smoke.'
            : 'Skies are mostly clear with low aerosol optical depth.',
  },
  {
    id: 'seaice',
    name: 'Polar Sea Ice',
    code: 'NSIDC-0051',
    source: 'NASA NSIDC DAAC',
    instrument: 'SSMIS passive microwave',
    resolution: '25 km polar stereo',
    cadence: 'Daily',
    variable: 'sea_ice_concentration',
    unit: '%',
    min: 0,
    max: 100,
    decimals: 0,
    palette: ['#020617', '#0c4a6e', '#0891b2', '#67e8f9', '#f8fafc'],
    landIsNoData: true,
    description: 'Fraction of each ocean grid cell covered by sea ice, from brightness temperatures.',
    higherMeans: 'more complete sea ice cover',
    accent: {
      text: 'text-sky-300',
      border: 'border-sky-400/60',
      bg: 'bg-sky-400/10',
      glow: 'shadow-[0_0_24px_-6px_rgba(125,211,252,0.55)]',
      hex: '#7dd3fc',
    },
    music: { scaleName: 'F lydian', scale: [0, 2, 4, 6, 7, 9, 11], root: 53, rootName: 'F', bpm: 76 },
    field: (lat, lon, land) => {
      if (land) return Number.NaN
      const n = sphereNoise(lat, lon, 5.5, 53, 4)
      const arcticEdge = 70 + (n - 0.5) * 16
      const antarcticEdge = -63 + (n - 0.5) * 10
      const arctic = smoothstep(arcticEdge - 6, arcticEdge + 4, lat)
      const antarctic = smoothstep(-antarcticEdge - 5, -antarcticEdge + 4, -lat)
      const conc = Math.max(arctic, antarctic * 0.92) * (0.78 + 0.22 * sphereNoise(lat, lon, 12, 61, 2))
      return clamp01(conc)
    },
    interpret: (m) =>
      m > 85
        ? 'Consolidated pack ice covers nearly the entire window.'
        : m > 50
          ? 'The window straddles a mixed ice zone with substantial but broken cover.'
          : m > 15
            ? 'The sampled area sits near the marginal ice edge, where floes break apart.'
            : 'Mostly open water, with little or no sea ice present.',
  },
]

export const getDataset = (id: DatasetId) => DATASETS.find((d) => d.id === id) ?? DATASETS[0]

export const toPhysical = (ds: Dataset, v: number) => ds.min + v * (ds.max - ds.min)

export function formatValue(ds: Dataset, physical: number) {
  const sign = ds.min < 0 && physical > 0 ? '+' : ''
  return `${sign}${physical.toFixed(ds.decimals)}`
}
