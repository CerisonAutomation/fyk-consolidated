import { createFileRoute } from '@tanstack/react-router'
import { NotificationsClient } from '../../components/notifications/notifications-client'

export const Route = createFileRoute('/notifications/')({
  component: NotificationsClient,
})
