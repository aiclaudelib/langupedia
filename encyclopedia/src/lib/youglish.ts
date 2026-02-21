// Youglish Widget API types and lazy script loader

export interface YGWidgetEvents {
  onFetchDone?: (event: { totalResult: number }) => void
  onVideoChange?: (event: { trackNumber: number; totalTracks: number }) => void
  onCaptionConsumed?: () => void
  onError?: (event: { code: number }) => void
}

export interface YGWidgetOptions {
  width?: number
  components?: number
  events: YGWidgetEvents
}

export interface YGWidgetInstance {
  fetch: (word: string, language: string) => void
  next: () => void
  previous: () => void
  close: () => void
}

export interface YGWidgetConstructor {
  new (containerId: string, options: YGWidgetOptions): YGWidgetInstance
}

declare global {
  interface Window {
    YG?: { Widget: YGWidgetConstructor }
    onYouglishAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null

export function loadYouglishAPI(): Promise<void> {
  if (apiPromise) return apiPromise

  apiPromise = new Promise<void>((resolve, reject) => {
    if (window.YG) {
      resolve()
      return
    }

    window.onYouglishAPIReady = () => {
      resolve()
    }

    const script = document.createElement('script')
    script.src = 'https://youglish.com/public/emb/widget.js'
    script.async = true
    script.onerror = () => {
      apiPromise = null
      reject(new Error('Failed to load Youglish API'))
    }
    document.body.appendChild(script)
  })

  return apiPromise
}
