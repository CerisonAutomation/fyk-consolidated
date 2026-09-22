/**
 * @deprecated Use src/components/ui/ barrel — canonical source
 * Kept for compatibility, re-exports professional components
 */

export { ProfileGrid as CascadeGrid } from "../grid/ProfileGrid";
export type { GridProfile } from "../grid/ProfileGrid";
export { MessageComposer as AIComposer } from "../composer/MessageComposer";
export { SafetyPanel as SafetyCenter } from "../safety/SafetyPanel";
export { ProfilePreviewCard as ProfileCard } from "../profile/ProfilePreviewCard";

// Legacy combined view — use individual components instead
import { ProfileGrid } from "../grid/ProfileGrid";
import { MessageComposer } from "../composer/MessageComposer";
import { SafetyPanel } from "../safety/SafetyPanel";
import { ProfilePreviewCard } from "../profile/ProfilePreviewCard";
import type { GridProfile } from "../grid/ProfileGrid";

export function DivineUX() {
  const mockProfiles: GridProfile[] = Array.from({ length: 20 }).map((_, i) => ({
    id: `profile-${i}`,
    name: `User ${i}`,
    age: 20 + (i % 15),
    photo: `https://picsum.photos/300/400?random=${i}`,
    distance: Math.round(Math.random() * 10 * 10) / 10,
    status: (["online", "active", "offline"] as const)[i % 3],
    verified: i % 3 === 0,
    compatibility: 50 + Math.floor(Math.random() * 50),
    isBoosted: i === 0,
    isFresh: i < 3,
  }));

  return (
    <div className="space-y-8 p-4 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">UI Components — Professional</h1>
        <p className="text-sm text-muted-foreground">Canonical components: ProfileGrid, MessageComposer, SafetyPanel, ProfilePreviewCard</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Profile Grid</h2>
        <ProfileGrid profiles={mockProfiles} columns={2} />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Message Composer</h2>
        <MessageComposer conversationId="test" />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Safety Panel</h2>
        <SafetyPanel />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Profile Preview Card</h2>
        <div className="grid grid-cols-2 gap-3">
          {mockProfiles.slice(0, 2).map((p) => (
            <ProfilePreviewCard
              key={p.id}
              profile={{
                displayName: p.name,
                age: p.age,
                avatar: p.photo,
                city: "Valletta",
                distance: p.distance ?? undefined,
                online: p.status === "online",
                verification: p.verified ? 2 : 0,
                bio: "Love hiking and coffee",
                tribes: ["Jock", "Geek"],
                interests: ["Gym", "Travel", "Music"],
                photos: [p.photo],
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
