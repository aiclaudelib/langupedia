export interface Definition {
  sense: number
  context?: string
  text: string
  examples?: string[]
}

export interface Comparison {
  word: string
  description: string
}

export interface Idiom {
  phrase: string
  explanation?: string
}

export interface RelatedForm {
  word: string
  partOfSpeech?: string
  description?: string
}

export interface Collocation {
  text?: string
  phrase?: string
}

export interface Word {
  word: string
  pronunciation?: string
  partOfSpeech?: string[]
  forms?: string | null
  image?: string
  definitions?: Definition[]
  mainExamples?: string[]
  usageNote?: string | null
  comparisons?: Comparison[]
  collocations?: (string | Collocation)[]
  idioms?: Idiom[]
  relatedForms?: RelatedForm[]
  wordHistory?: string | null
  contextStory?: string | null
  meta?: {
    timesAccessed: number
    lastReviewed: string | null
    srsLevel: number
    dateAdded: string
  }
}
