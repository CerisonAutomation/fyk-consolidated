import { createFileRoute } from '@tanstack/react-router'
import { GamechangersClient } from '../../components/gamechangers/gamechangers-client'

export const Route = createFileRoute('/gamechangers/')({
  component: GamechangersClient,
})
