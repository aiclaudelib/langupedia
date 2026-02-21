import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Project } from '../types/project'
import { queryKeys } from '../lib/queryKeys'
import { isStaticMode } from '../lib/dataProvider'

interface Props {
  project: Project
  onEdit?: (project: Project) => void
}

export default function ProjectCard({ project, onEdit }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete project')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    },
  })

  const handleClick = () => {
    navigate({ to: '/projects/$projectId', params: { projectId: project.id }, search: { lang: undefined } })
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.(project)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      deleteMutation.mutate()
    }
  }

  const date = new Date(project.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="project-card" onClick={handleClick}>
      {!isStaticMode && (
        <>
          <button
            className="project-card-edit"
            onClick={handleEdit}
            title="Edit project"
          >
            &#9998;
          </button>
          <button
            className="project-card-delete"
            onClick={handleDelete}
            title="Delete project"
          >
            &times;
          </button>
        </>
      )}
      <h2 className="project-card-name">{project.name}</h2>
      {project.subtitle && (
        <p className="project-card-subtitle">{project.subtitle}</p>
      )}
      <div className="project-card-meta">
        <span>{project.wordCount} words</span>
        <span>{date}</span>
      </div>
    </div>
  )
}
