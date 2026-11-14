'use client'

import { type RefObject, useEffect, useRef } from 'react'
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
import { type DatasetTexture, getLandFeature, textureIndex } from '@/lib/polaris/texture'
import type { ViewState } from '@/lib/polaris/track'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI
const MAX_BUFFER_W = 600

export const ZOOM_MIN = 1
export const ZOOM_MAX = 5
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

interface EarthCanvasProps {
  texture: DatasetTexture | null
  zoom: number
  autoOrbit: boolean
  viewRef: RefObject<ViewState>
  onZoomChange: (zoom: number) => void
  onUserRotate: () => void
  onViewTick: (view: ViewState) => void
}

export function EarthCanvas({
  texture,
  zoom,
  autoOrbit,
  viewRef,
  onZoomChange,
  onUserRotate,
  onViewTick,
}: EarthCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textureRef = useRef(texture)
  const zoomRef = useRef(zoom)
  const autoOrbitRef = useRef(autoOrbit)
  const dirtyRef = useRef(true)
  const callbacksRef = useRef({ onZoomChange, onUserRotate, onViewTick })

  useEffect(() => {
    textureRef.current = texture
    dirtyRef.current = true
  }, [texture])
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])
  useEffect(() => {
    autoOrbitRef.current = autoOrbit
  }, [autoOrbit])
  useEffect(() => {
    callbacksRef.current = { onZoomChange, onUserRotate, onViewTick }
  }, [onZoomChange, onUserRotate, onViewTick])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const buffer = document.createElement('canvas')
    const bctx = buffer.getContext('2d')
    if (!container || !canvas || !ctx || !bctx) return

    let cssW = 1
    let cssH = 1
    let dpr = 1
    let image = bctx.createImageData(1, 1)
    let raf = 0
    let last = performance.now()
    let lastEmit = 0
    let dragging = false
    let lastX = 0
    let lastY = 0

    const resize = () => {
      const rect = container.getBoundingClientRect()
      cssW = Math.max(1, rect.width)
      cssH = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      const s = Math.min(1, MAX_BUFFER_W / cssW)
      buffer.width = Math.max(1, Math.round(cssW * s))
      buffer.height = Math.max(1, Math.round(cssH * s))
      image = bctx.createImageData(buffer.width, buffer.height)
      dirtyRef.current = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    const projection = geoOrthographic().clipAngle(90).precision(0.6)
    const path = geoPath(projection, ctx)
    const graticule = geoGraticule10()
    const land = getLandFeature()

    const drawPixels = (tex: DatasetTexture, R: number) => {
      const view = viewRef.current
      const bw = buffer.width
      const bh = buffer.height
      const s = bw / cssW
      const Rb = R * s
      const bcx = bw / 2
      const bcy = bh / 2
      const sinP = Math.sin(view.lat * D2R)
      const cosP = Math.cos(view.lat * D2R)
      const lam0 = view.lon * D2R
      const data = image.data
      data.fill(0)
      const x0 = Math.max(0, Math.floor(bcx - Rb))
      const x1 = Math.min(bw, Math.ceil(bcx + Rb))
      const y0 = Math.max(0, Math.floor(bcy - Rb))
      const y1 = Math.min(bh, Math.ceil(bcy + Rb))
      const rgb = tex.rgb
      for (let y = y0; y < y1; y++) {
        const py = -(y + 0.5 - bcy) / Rb
        const py2 = py * py
        if (py2 > 1) continue
        for (let x = x0; x < x1; x++) {
          const px = (x + 0.5 - bcx) / Rb
          const r2 = px * px + py2
          if (r2 > 1) continue
          const z = Math.sqrt(1 - r2)
          const lat = Math.asin(py * cosP + z * sinP)
          const lon = lam0 + Math.atan2(px, z * cosP - py * sinP)
          const ti = textureIndex(lat, lon) * 3
          const shade = 0.42 + 0.58 * z
          const di = (y * bw + x) * 4
          data[di] = rgb[ti] * shade
          data[di + 1] = rgb[ti + 1] * shade
          data[di + 2] = rgb[ti + 2] * shade
          data[di + 3] = r2 > 0.98 ? ((1 - r2) / 0.02) * 255 : 255
        }
      }
      bctx.putImageData(image, 0, 0)
    }

    const draw = () => {
      const view = viewRef.current
      const R = Math.min(cssW, cssH) * 0.42 * view.zoom
      view.radius = R
      const cx = cssW / 2
      const cy = cssH / 2

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.14)
      glow.addColorStop(0, 'rgba(34, 211, 238, 0.32)')
      glow.addColorStop(0.45, 'rgba(34, 211, 238, 0.1)')
      glow.addColorStop(1, 'rgba(34, 211, 238, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2)
      ctx.fill()

      const tex = textureRef.current
      if (tex) {
        drawPixels(tex, R)
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(buffer, 0, 0, cssW, cssH)
      }

      projection.scale(R).translate([cx, cy]).rotate([-view.lon, -view.lat])
      ctx.beginPath()
      path(graticule)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.13)'
      ctx.lineWidth = 0.6
      ctx.stroke()

      ctx.beginPath()
      path(land)
      ctx.strokeStyle = 'rgba(165, 243, 252, 0.5)'
      ctx.lineWidth = 0.75
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.3)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      const view = viewRef.current
      if (autoOrbitRef.current && !dragging) {
        view.lon = ((view.lon + dt * 5 + 540) % 360) - 180
        dirtyRef.current = true
      }
      const target = zoomRef.current
      if (Math.abs(view.zoom - target) > 0.002) {
        view.zoom += (target - view.zoom) * Math.min(1, dt * 12)
        dirtyRef.current = true
      } else if (view.zoom !== target) {
        view.zoom = target
        dirtyRef.current = true
      }
      if (dirtyRef.current) {
        dirtyRef.current = false
        draw()
      }
      if (t - lastEmit > 120) {
        lastEmit = t
        callbacksRef.current.onViewTick({ ...view })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const rotateBy = (dx: number, dy: number) => {
      const view = viewRef.current
      const R = view.radius || 200
      view.lon = ((view.lon - (dx / R) * R2D + 540) % 360) - 180
      view.lat = Math.max(-85, Math.min(85, view.lat + (dy / R) * R2D))
      dirtyRef.current = true
    }

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      container.setPointerCapture(e.pointerId)
      callbacksRef.current.onUserRotate()
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      rotateBy(e.clientX - lastX, e.clientY - lastY)
      lastX = e.clientX
      lastY = e.clientY
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      if (container.hasPointerCapture(e.pointerId)) container.releasePointerCapture(e.pointerId)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const next = clampZoom(zoomRef.current * Math.exp(-e.deltaY * 0.0015))
      callbacksRef.current.onZoomChange(Math.round(next * 100) / 100)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const step = 24
      const keys: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      }
      if (keys[e.key]) {
        e.preventDefault()
        callbacksRef.current.onUserRotate()
        rotateBy(...keys[e.key])
      } else if (e.key === '+' || e.key === '=') {
        callbacksRef.current.onZoomChange(clampZoom(Math.round((zoomRef.current + 0.2) * 10) / 10))
      } else if (e.key === '-' || e.key === '_') {
        callbacksRef.current.onZoomChange(clampZoom(Math.round((zoomRef.current - 0.2) * 10) / 10))
      }
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointercancel', onPointerUp)
    container.addEventListener('wheel', onWheel, { passive: false })
    container.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointercancel', onPointerUp)
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('keydown', onKeyDown)
    }
  }, [viewRef])

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="False-color Earth globe. Drag or use arrow keys to rotate, scroll or press plus and minus to zoom."
      tabIndex={0}
      className="absolute inset-0 cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400/60 active:cursor-grabbing"
    >
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  )
}
