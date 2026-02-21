import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Project } from '../types/project'
import { queryKeys } from '../lib/queryKeys'

interface Props {
  onClose: () => void
  project?: Project
}

export default function ProjectFormModal({ onClose, project }: Props) {
  const isEdit = !!project
  const [name, setName] = useState(project?.name ?? '')
  const [title, setTitle] = useState(project?.title ?? '')
  const [subtitle, setSubtitle] = useState(project?.subtitle ?? '')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, title: title || name, subtitle }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to update project')
        }
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, title: title || name, subtitle }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to create project')
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) })
      }
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    mutation.mutate()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-project-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit Project' : 'New Project'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Vocabulary"
              autoFocus={!isEdit}
              readOnly={isEdit}
              className={isEdit ? 'input-readonly' : undefined}
              required
            />
          </label>
          <label>
            <span>Title (header H1)</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Words Worth Knowing"
              autoFocus={isEdit}
            />
          </label>
          <label>
            <span>Subtitle</span>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. A personal collection of English words"
            />
          </label>
          {mutation.error && (
            <p className="modal-error">{(mutation.error as Error).message}</p>
          )}
          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-btn-create" disabled={mutation.isPending}>
              {mutation.isPending
                ? (isEdit ? 'Saving...' : 'Creating...')
                : (isEdit ? 'Save' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
