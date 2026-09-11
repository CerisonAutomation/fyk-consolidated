import { createFileRoute } from '@tanstack/react-router'
import { PremiumClient } from '../../components/premium/premium-client'

export const Route = createFileRoute('/premium/')({
  component: PremiumClient,
})
