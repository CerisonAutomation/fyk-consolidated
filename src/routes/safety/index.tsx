import { createFileRoute } from '@tanstack/react-router'
import { SafetyClient } from '../../components/safety/safety-client'

export const Route = createFileRoute('/safety/')({
  component: SafetyClient,
})
