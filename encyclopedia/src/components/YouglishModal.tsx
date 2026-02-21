import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { loadYouglishAPI } from '../lib/youglish'
import type { YGWidgetInstance } from '../lib/youglish'

interface Props {
  word: string
  onClose: () => void
}

type Status = 'loading' | 'ready' | 'no-results' | 'error'

export default function YouglishModal({ word, onClose }: Props) {
  const [status, setStatus] = useState<Status>('loading')
  const [trackInfo, setTrackInfo] = useState({ current: 0, total: 0 })
  const widgetRef = useRef<YGWidgetInstance | null>(null)
  const uid = useId().replace(/:/g, '')
  const containerId = `youglish-widget-${uid}`

  const close = useCallback(() => {
    if (widgetRef.current) {
      widgetRef.current.close()
      widgetRef.current = null
    }
    onClose()
  }, [onClose])

  // Escape key handler + body scroll lock
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [close])

  // Load API and initialize widget
  useEffect(() => {
    let cancelled = false

    loadYouglishAPI()
      .then(() => {
        if (cancelled || !window.YG) return

        const widget = new window.YG.Widget(containerId, {
          components: 9, // search bar (1) + caption (8)
          events: {
            onFetchDone: (event) => {
              if (cancelled) return
              if (event.totalResult === 0) {
                setStatus('no-results')
              } else {
                setStatus('ready')
                setTrackInfo((prev) => ({ ...prev, total: event.totalResult }))
              }
            },
            onVideoChange: (event) => {
              if (cancelled) return
              setTrackInfo({
                current: event.trackNumber,
                total: event.totalTracks,
              })
            },
            onError: () => {
              if (cancelled) return
              setStatus('error')
            },
          },
        })

        widgetRef.current = widget
        widget.fetch(word, 'english')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      if (widgetRef.current) {
        widgetRef.current.close()
        widgetRef.current = null
      }
    }
  }, [word, containerId])

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="youglish-modal" onClick={(e) => e.stopPropagation()}>
        <div className="youglish-modal-header">
          <h2>Listen: {word}</h2>
          <button className="youglish-close-btn" onClick={close} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="youglish-modal-body">
          {status === 'loading' && (
            <div className="youglish-status">Loading...</div>
          )}
          {status === 'no-results' && (
            <div className="youglish-status">No videos found for "{word}"</div>
          )}
          {status === 'error' && (
            <div className="youglish-status">Failed to load videos. Please try again.</div>
          )}
          <div id={containerId} style={status === 'loading' ? { visibility: 'hidden', height: 0 } : undefined} />
        </div>

        {status === 'ready' && (
          <div className="youglish-modal-footer">
            <button
              className="youglish-nav-btn"
              onClick={() => widgetRef.current?.previous()}
            >
              &larr; Prev
            </button>
            <span className="youglish-track-info">
              {trackInfo.current} of {trackInfo.total}
            </span>
            <button
              className="youglish-nav-btn"
              onClick={() => widgetRef.current?.next()}
            >
              Next &rarr;
            </button>
          </div>
        )}

        <div className="youglish-attribution">
          Powered by <a href="https://youglish.com" target="_blank" rel="noopener noreferrer">YouGlish.com</a>
        </div>
      </div>
    </div>
  )
}
