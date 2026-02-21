import { Link } from '@tanstack/react-router'

export default function NotFound() {
  return (
    <main className="dashboard">
      <div className="not-found">
        <h1>404</h1>
        <p>Page not found</p>
        <Link to="/">Back to Projects</Link>
      </div>
    </main>
  )
}
