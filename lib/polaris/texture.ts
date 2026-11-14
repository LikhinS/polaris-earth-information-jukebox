import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import land110 from 'world-atlas/land-110m.json'
import { sphereNoise } from './noise'
import type { Dataset, DatasetId } from './datasets'

export const TEX_W = 720
export const TEX_H = 360

export interface DatasetTexture {
  id: DatasetId
  rgb: Uint8ClampedArray
  values: Float32Array
}

type LandFeature = Feature<Geometry> | FeatureCollection<Geometry>

let landFeature: LandFeature | null = null
let landMask: Uint8Array | null = null
const cache = new Map<DatasetId, DatasetTexture>()

export function getLandFeature(): LandFeature {
  if (!landFeature) {
    // world-atlas ships untyped JSON; topojson-client validates the shape at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topo = land110 as any
    landFeature = feature(topo, topo.objects.land) as unknown as LandFeature
  }
  return landFeature
}

function getLandMask() {
  if (landMask) return landMask
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D unavailable')
  const projection = geoEquirectangular()
    .scale(TEX_W / (2 * Math.PI))
    .translate([TEX_W / 2, TEX_H / 2])
  const path = geoPath(projection, ctx)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  path(getLandFeature())
  ctx.fill()
  const pixels = ctx.getImageData(0, 0, TEX_W, TEX_H).data
  landMask = new Uint8Array(TEX_W * TEX_H)
  for (let i = 0; i < landMask.length; i++) landMask[i] = pixels[i * 4 + 3] > 127 ? 1 : 0
  return landMask
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function buildPaletteLut(stops: string[]) {
  const rgb = stops.map(hexToRgb)
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (rgb.length - 1)
    const k = Math.min(rgb.length - 2, Math.floor(t))
    const f = t - k
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f
  }
  return lut
}

export function getDatasetTexture(ds: Dataset): DatasetTexture {
  const cached = cache.get(ds.id)
  if (cached) return cached
  const mask = getLandMask()
  const lut = buildPaletteLut(ds.palette)
  const rgb = new Uint8ClampedArray(TEX_W * TEX_H * 3)
  const values = new Float32Array(TEX_W * TEX_H)
  for (let y = 0; y < TEX_H; y++) {
    const lat = 90 - ((y + 0.5) / TEX_H) * 180
    for (let x = 0; x < TEX_W; x++) {
      const lon = ((x + 0.5) / TEX_W) * 360 - 180
      const i = y * TEX_W + x
      const land = mask[i] === 1
      const v = ds.field(lat, lon, land)
      values[i] = v
      const o = i * 3
      if (Number.isNaN(v)) {
        const relief = 18 + sphereNoise(lat, lon, 9, 7, 2) * 16
        rgb[o] = relief
        rgb[o + 1] = relief + 3
        rgb[o + 2] = relief + 10
      } else {
        const li = Math.round(v * 255) * 3
        const dim = land && !ds.landIsNoData ? 0.88 : 1
        rgb[o] = lut[li] * dim
        rgb[o + 1] = lut[li + 1] * dim
        rgb[o + 2] = lut[li + 2] * dim
      }
    }
  }
  const tex = { id: ds.id, rgb, values }
  cache.set(ds.id, tex)
  return tex
}

export function textureIndex(latRad: number, lonRad: number) {
  let tx = Math.floor((lonRad / (2 * Math.PI) + 0.5) * TEX_W) % TEX_W
  if (tx < 0) tx += TEX_W
  let ty = Math.floor((0.5 - latRad / Math.PI) * TEX_H)
  if (ty < 0) ty = 0
  else if (ty >= TEX_H) ty = TEX_H - 1
  return ty * TEX_W + tx
}
