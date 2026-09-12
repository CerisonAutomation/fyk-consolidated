import { createFileRoute } from '@tanstack/react-router'
import { FansitesClient } from '../../components/fansites/fansites-client'

export const Route = createFileRoute('/fansites/')({
  component: FansitesClient,
})
