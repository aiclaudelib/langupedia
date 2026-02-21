import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router'
import Dashboard from './pages/Dashboard'
import LexiconView from './pages/LexiconView'
import NotFound from './pages/NotFound'

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const lexiconRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: LexiconView,
  validateSearch: (search: Record<string, unknown>) => ({
    lang: typeof search.lang === 'string' ? search.lang : undefined,
  }),
})

const routeTree = rootRoute.addChildren([dashboardRoute, lexiconRoute])

const base = import.meta.env.BASE_URL

export const router = createRouter({
  routeTree,
  basepath: base.length > 1 && base.endsWith('/') ? base.slice(0, -1) : undefined,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
