const D2R = Math.PI / 180

function hash3(x: number, y: number, z: number, seed: number) {
  let h = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function valueNoise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = smooth(x - xi)
  const v = smooth(y - yi)
  const w = smooth(z - zi)
  const c000 = hash3(xi, yi, zi, seed)
  const c100 = hash3(xi + 1, yi, zi, seed)
  const c010 = hash3(xi, yi + 1, zi, seed)
  const c110 = hash3(xi + 1, yi + 1, zi, seed)
  const c001 = hash3(xi, yi, zi + 1, seed)
  const c101 = hash3(xi + 1, yi, zi + 1, seed)
  const c011 = hash3(xi, yi + 1, zi + 1, seed)
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed)
  return lerp(
    lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
    lerp(lerp(c001, c101, u), lerp(c011, c111, u), v),
    w,
  )
}

/** Seamless fractal noise sampled on the unit sphere. Returns roughly 0..1. */
export function sphereNoise(lat: number, lon: number, freq: number, seed: number, octaves = 3) {
  const phi = lat * D2R
  const lam = lon * D2R
  const x = Math.cos(phi) * Math.cos(lam)
  const y = Math.cos(phi) * Math.sin(lam)
  const z = Math.sin(phi)
  let amp = 0.5
  let f = freq
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise3(x * f + 11.3, y * f + 7.1, z * f + 3.7, seed + i * 101)
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return sum / norm
}

/** Gaussian blob in lat/lon degrees with longitude wrap-around. */
export function blob(lat: number, lon: number, lat0: number, lon0: number, sLat: number, sLon: number) {
  let dLon = lon - lon0
  if (dLon > 180) dLon -= 360
  if (dLon < -180) dLon += 360
  const dLat = lat - lat0
  return Math.exp(-((dLat * dLat) / (2 * sLat * sLat) + (dLon * dLon) / (2 * sLon * sLon)))
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
