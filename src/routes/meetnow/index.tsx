import { createFileRoute } from '@tanstack/react-router'
import { MeetNowClient } from '../../components/meetnow/meetnow-client'

export const Route = createFileRoute('/meetnow/')({
  component: MeetNowClient,
})
