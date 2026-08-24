import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import {
  getContext,
} from './integrations/tanstack-query/root-provider'

function DefaultNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
      <h1 className="text-2xl font-bold text-foreground">Page Not Found</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      <a href="/" className="text-primary hover:underline font-medium">Go Home</a>
    </div>
  )
}

function DefaultError({ error }: { error: Error }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
      <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
      <p className="text-muted-foreground">{error.message}</p>
      <a href="/" className="text-primary hover:underline font-medium">Go Home</a>
    </div>
  )
}

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: DefaultNotFound,
    defaultErrorComponent: DefaultError,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
