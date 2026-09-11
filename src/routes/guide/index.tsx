import { createFileRoute } from '@tanstack/react-router'

function GuidePlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="text-6xl mb-4">🗺️</div>
      <h1 className="text-2xl font-bold mb-2">Venue Guide</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Venue guide coming soon. This feature will be built by another agent.
      </p>
    </div>
  )
}

export const Route = createFileRoute('/guide/')({
  component: GuidePlaceholder,
})
