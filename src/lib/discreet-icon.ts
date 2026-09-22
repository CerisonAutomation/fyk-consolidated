/**
 * Discreet App Icon — 1.6, Security Feature
 * Multiple launcher icons bundled (camera, music, notes, to-do, calculator).
 * User picks which shows on device; logo swap without changing function.
 */

export type DiscreetIcon = {
  id: string;
  label: string;
  icon: string; // emoji or icon name
  description: string;
  category: "utility" | "media" | "productivity";
};

export const DISCREET_ICONS: DiscreetIcon[] = [
  { id: "default", label: "FYK", icon: "👑", description: "Default app icon", category: "utility" },
  { id: "camera", label: "Camera", icon: "📷", description: "Looks like camera app", category: "media" },
  { id: "music", label: "Music", icon: "🎵", description: "Looks like music player", category: "media" },
  { id: "notes", label: "Notes", icon: "📝", description: "Looks like notes app", category: "productivity" },
  { id: "todo", label: "To-Do", icon: "✅", description: "Looks like task manager", category: "productivity" },
  { id: "calculator", label: "Calculator", icon: "🔢", description: "Looks like calculator", category: "utility" },
  { id: "weather", label: "Weather", icon: "⛅", description: "Looks like weather app", category: "utility" },
  { id: "calendar", label: "Calendar", icon: "📅", description: "Looks like calendar", category: "productivity" },
];

export function getDiscreetIcon(id: string): DiscreetIcon | undefined {
  return DISCREET_ICONS.find((i) => i.id === id);
}

export function validateDiscreetIcon(id: string): boolean {
  return DISCREET_ICONS.some((i) => i.id === id);
}

// Browser implementation uses manifest + service worker to swap icon
// Real native app would use Android's activity-alias and iOS alternate icons

export function generateManifestWithIcon(iconId: string): { name: string; icons: any[] } {
  const icon = getDiscreetIcon(iconId) ?? DISCREET_ICONS[0];
  return {
    name: icon.label,
    icons: [
      { src: `/icons/icon-${iconId}-192.png`, sizes: "192x192", type: "image/png" },
      { src: `/icons/icon-${iconId}-512.png`, sizes: "512x512", type: "image/png" },
    ],
  };
}
