import { useState, useRef, useCallback } from 'react'
import type { WordAudio } from '../types/word'

const ACCENT_LABELS = [
  ['us', 'US'],
  ['uk', 'UK'],
  ['au', 'AU'],
] as const

interface PronunciationPlayerProps {
  audio: WordAudio
}

export default function PronunciationPlayer({ audio }: PronunciationPlayerProps) {
  const [playingAccent, setPlayingAccent] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const play = useCallback((accent: string, url: string) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    const el = new Audio(url)
    audioRef.current = el
    setPlayingAccent(accent)

    el.addEventListener('ended', () => setPlayingAccent(null))
    el.addEventListener('error', () => setPlayingAccent(null))
    el.play().catch(() => setPlayingAccent(null))
  }, [])

  const accents = ACCENT_LABELS.filter(([key]) => audio[key])

  if (accents.length === 0) return null

  return (
    <span className="pronunciation-player">
      {accents.map(([key, label]) => {
        const isPlaying = playingAccent === key
        return (
          <button
            key={key}
            className={`pronunciation-play-btn${isPlaying ? ' playing' : ''}`}
            onClick={() => play(key, audio[key]!)}
            aria-label={`Play ${label} pronunciation`}
          >
            {isPlaying ? '\u25A0' : '\u25B6\uFE0E'} {label}
          </button>
        )
      })}
    </span>
  )
}
