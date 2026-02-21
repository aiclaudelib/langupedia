import type { Project } from '../types/project'
import type { Word } from '../types/word'

export const isStaticMode = import.meta.env.VITE_DEPLOY_MODE === 'ghpages'

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export async function fetchProjects(): Promise<Project[]> {
  if (isStaticMode) {
    const res = await fetch(`${base}/data/projects/index.json`)
    if (!res.ok) throw new Error('Failed to load projects')
    return res.json()
  }
  const res = await fetch('/api/projects')
  if (!res.ok) throw new Error('Failed to load projects')
  return res.json()
}

export async function fetchProject(id: string): Promise<Project> {
  if (isStaticMode) {
    const projects = await fetchProjects()
    const project = projects.find((p) => p.id === id)
    if (!project) throw new Error('Project not found')
    return project
  }
  const res = await fetch(`/api/projects/${id}`)
  if (!res.ok) throw new Error('Failed to load project')
  return res.json()
}

export async function fetchWords(id: string, lang: string): Promise<Word[]> {
  if (isStaticMode) {
    const res = await fetch(`${base}/data/projects/${id}/words.${lang}.json`)
    if (!res.ok) throw new Error(`Failed to load words.${lang}.json`)
    return res.json()
  }
  const res = await fetch(`/api/projects/${id}/words?lang=${lang}`)
  if (!res.ok) throw new Error(`Failed to load words.${lang}.json`)
  return res.json()
}
