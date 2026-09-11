import { createFileRoute } from '@tanstack/react-router'
import { GroupsClient } from '../../components/groups/groups-client'

export const Route = createFileRoute('/groups/')({
  component: GroupsClient,
})
