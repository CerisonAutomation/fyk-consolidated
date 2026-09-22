import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'
import { requireDocumentSession } from '../../lib/document-auth'

export const Route = createFileRoute('/safety/')({
  beforeLoad: async () => {
    await requireDocumentSession()
  },
  component: lazyRouteComponent(() => import('../../components/safety/safety-client').then((m) => ({ default: m.SafetyClient }))),
})
