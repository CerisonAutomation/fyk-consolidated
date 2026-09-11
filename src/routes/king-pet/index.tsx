import { createFileRoute } from '@tanstack/react-router'
import { KingPetClient } from '../../components/king-pet/king-pet-client'

export const Route = createFileRoute('/king-pet/')({
  component: KingPetClient,
})
