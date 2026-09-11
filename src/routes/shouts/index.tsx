import { createFileRoute } from '@tanstack/react-router'
import { ShoutsClient } from '../../components/shouts/shouts-client'

export const Route = createFileRoute('/shouts/')({
  component: ShoutsClient,
})
