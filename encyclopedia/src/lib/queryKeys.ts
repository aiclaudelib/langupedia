export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    detail: (id: string) => ['projects', id] as const,
  },
  words: {
    byProject: (id: string, lang: string) => ['words', id, lang] as const,
  },
}
