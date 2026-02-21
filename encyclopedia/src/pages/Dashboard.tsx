import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Project } from '../types/project'
import { queryKeys } from '../lib/queryKeys'
import { fetchProjects, isStaticMode } from '../lib/dataProvider'
import ProjectCard from '../components/ProjectCard'
import ProjectFormModal from '../components/ProjectFormModal'

export default function Dashboard() {
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: (): Promise<Project[]> => fetchProjects(),
  })

  const closeModal = () => {
    setShowModal(false)
    setEditingProject(null)
  }

  return (
    <main className="dashboard">
      <header className="header">
        <h1 className="header-title">Lexicon</h1>
        <p className="header-subtitle">Your Vocabulary Projects</p>
      </header>

      <section className="projects-grid">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onEdit={setEditingProject} />
        ))}

        {!isStaticMode && (
          <button
            className="project-card project-card-add"
            onClick={() => setShowModal(true)}
          >
            <span className="project-card-add-icon">+</span>
            <span className="project-card-add-text">New Project</span>
          </button>
        )}
      </section>

      {!isStaticMode && (showModal || editingProject) && (
        <ProjectFormModal
          onClose={closeModal}
          project={editingProject ?? undefined}
        />
      )}
    </main>
  )
}
