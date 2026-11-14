'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type DatasetId, getDataset } from '@/lib/polaris/datasets'
import { type DatasetTexture, getDatasetTexture } from '@/lib/polaris/texture'
import { type Track, type ViewState, generateTrack, sampleWindow } from '@/lib/polaris/track'
import { useSonification } from '@/hooks/use-sonification'
import { useSpeech } from '@/hooks/use-speech'
import { DatasetSidebar } from './dataset-sidebar'
import { DawPanel } from './daw-panel'
import { EarthViewport } from './earth-viewport'
import { TopNavbar } from './top-navbar'

const INITIAL_VIEW = { lon: -125, lat: 8, zoom: 1.2 }

export function JukeboxWorkspace() {
  const [datasetId, setDatasetId] = useState<DatasetId>('sst')
  const [texture, setTexture] = useState<DatasetTexture | null>(null)
  const [zoom, setZoom] = useState(INITIAL_VIEW.zoom)
  const [autoOrbit, setAutoOrbit] = useState(true)
  const [track, setTrack] = useState<Track | null>(null)
  const [generating, setGenerating] = useState(false)
  const [autoNarrate, setAutoNarrate] = useState(false)
  const viewRef = useRef<ViewState>({ ...INITIAL_VIEW, radius: 200 })
  const trackCounter = useRef(0)
  const generateTimer = useRef<number | null>(null)

  const dataset = getDataset(datasetId)
  const audio = useSonification(track)
  const { setDucked } = audio
  const speech = useSpeech(setDucked)

  useEffect(() => {
    setTexture(getDatasetTexture(getDataset(datasetId)))
  }, [datasetId])

  useEffect(() => {
    if (!texture || trackCounter.current > 0) return
    trackCounter.current = 1
    setTrack(generateTrack(getDataset(texture.id), sampleWindow(texture, viewRef.current), viewRef.current, 1))
  }, [texture])

  useEffect(
    () => () => {
      if (generateTimer.current !== null) window.clearTimeout(generateTimer.current)
    },
    [],
  )

  const handleGenerate = () => {
    if (!texture || generating) return
    setGenerating(true)
    generateTimer.current = window.setTimeout(() => {
      trackCounter.current += 1
      const view = { ...viewRef.current }
      const next = generateTrack(dataset, sampleWindow(texture, view), view, trackCounter.current)
      setTrack(next)
      setGenerating(false)
      if (autoNarrate) speech.speak(next.narration)
    }, 900)
  }

  const handleToggleStep = useCallback((lane: number, step: number) => {
    setTrack((prev) => {
      if (!prev) return prev
      const lanes = prev.lanes.map((l, li) =>
        li !== lane
          ? l
          : {
              ...l,
              steps: l.steps.map((s, si) =>
                si === step ? { ...s, active: !s.active, velocity: s.velocity || 0.6 } : s,
              ),
            },
      )
      return { ...prev, lanes }
    })
  }, [])

  const handleResetView = useCallback(() => {
    viewRef.current.lon = INITIAL_VIEW.lon
    viewRef.current.lat = INITIAL_VIEW.lat
    setZoom(INITIAL_VIEW.zoom)
    setAutoOrbit(false)
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-200 lg:h-dvh lg:overflow-hidden">
      <TopNavbar audioStatus={audio.status} />
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <DatasetSidebar selected={datasetId} onSelect={setDatasetId} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <EarthViewport
            dataset={dataset}
            texture={texture}
            viewRef={viewRef}
            zoom={zoom}
            onZoomChange={setZoom}
            autoOrbit={autoOrbit}
            onAutoOrbitChange={setAutoOrbit}
            scanning={generating}
            onResetView={handleResetView}
          />
          <DawPanel
            dataset={dataset}
            track={track}
            generating={generating}
            status={audio.status}
            getPlayhead={audio.getPlayhead}
            onGenerate={handleGenerate}
            onPlay={() => void audio.play()}
            onPause={audio.pause}
            onReplay={audio.replay}
            onToggleStep={handleToggleStep}
            speech={speech}
            autoNarrate={autoNarrate}
            onAutoNarrateChange={setAutoNarrate}
          />
        </div>
      </main>
    </div>
  )
}
