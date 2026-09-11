import { createFileRoute } from '@tanstack/react-router'
import { TribesClient } from '../../components/tribes/tribes-client'

export const Route = createFileRoute('/tribes/')({
  component: TribesClient,
})
