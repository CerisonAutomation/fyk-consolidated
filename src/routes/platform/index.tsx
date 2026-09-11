import { createFileRoute } from '@tanstack/react-router'

function PlatformPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="text-6xl mb-4">🌐</div>
      <h1 className="text-2xl font-bold mb-2">Platform</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Crypto/WebGPU demo coming soon. This feature will be built by another agent.
      </p>
    </div>
  )
}

export const Route = createFileRoute('/platform/')({
  component: PlatformPlaceholder,
})
