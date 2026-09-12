import { createFileRoute } from '@tanstack/react-router'
import { NotificationsClient } from '../../components/notifications/notifications-client'
import { requireDocumentSession } from '../../lib/document-auth'

export const Route = createFileRoute('/notifications/')({
  // AUDIT §3.3: a stranger must not be handed this screen at all. The document is
  // redirected before it renders; `requireDocumentSession` is a no-op in the
  // browser, where /api/* already answers 401 for the same missing session.
  beforeLoad: async () => {
    await requireDocumentSession()
  },
  component: NotificationsClient,
})
