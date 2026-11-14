'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

export function useSpeech(onSpeakingChange?: (speaking: boolean) => void) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => 'speechSynthesis' in window,
    () => false,
  )
  const [speaking, setSpeaking] = useState(false)

  const update = useCallback(
    (s: boolean) => {
      setSpeaking(s)
      onSpeakingChange?.(s)
    },
    [onSpeakingChange],
  )

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    update(false)
  }, [supported, update])

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.98
      utterance.pitch = 1
      utterance.lang = 'en-US'
      utterance.onstart = () => update(true)
      utterance.onend = () => update(false)
      utterance.onerror = () => update(false)
      window.speechSynthesis.speak(utterance)
    },
    [supported, update],
  )

  useEffect(
    () => () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    [],
  )

  return { supported, speaking, speak, stop }
}
