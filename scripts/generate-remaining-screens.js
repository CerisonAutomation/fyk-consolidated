import fs from 'fs';
import path from 'path';

const screens = [
  { name: 'welcome', route: '/welcome/', file: 'src/routes/welcome/index.tsx', desc: 'Welcome onboarding with promo WELCOME15' },
  { name: 'forgot-password', route: '/forgot-password/', file: 'src/routes/forgot-password/index.tsx', desc: 'Forgot password with email reset' },
  { name: 'privacy-settings', route: '/settings/privacy/', file: 'src/routes/settings/privacy/index.tsx', desc: 'Privacy settings with GDPR, incognito, hide distance, screenshot blocking' },
  { name: 'pin-lock', route: '/settings/pin-lock/', file: 'src/routes/settings/pin-lock/index.tsx', desc: 'PIN lock with 4-digit, biometric, auto-lock' },
  { name: 'dnd-settings', route: '/settings/dnd/', file: 'src/routes/settings/dnd/index.tsx', desc: 'DND settings 22:00-07:00, notification mute' },
  { name: 'discreet-icon', route: '/settings/discreet-icon/', file: 'src/routes/settings/discreet-icon/index.tsx', desc: 'Discreet icon with app icon masking' },
  { name: 'deactivate-account', route: '/settings/deactivate/', file: 'src/routes/settings/deactivate/index.tsx', desc: 'Deactivate account with GDPR delete, data export' },
  { name: 'notification-settings', route: '/settings/notifications/', file: 'src/routes/settings/notifications/index.tsx', desc: 'Notification settings with push, email, in-app toggles' },
  { name: 'favorites', route: '/favorites/', file: 'src/routes/favorites/index.tsx', desc: 'Favorites with blocked, liked, vouched' },
  { name: 'search-inbox', route: '/search-inbox/', file: 'src/routes/search-inbox/index.tsx', desc: 'Search inbox with fuzzy search, filters' },
  { name: 'change-password', route: '/settings/change-password/', file: 'src/routes/settings/change-password/index.tsx', desc: 'Change password with current, new, confirm, strength' },
  { name: 'backup-restore', route: '/settings/backup-restore/', file: 'src/routes/settings/backup-restore/index.tsx', desc: 'Backup restore with export, import, encryption' },
  { name: 'report-user', route: '/report-user/', file: 'src/routes/report-user/index.tsx', desc: 'Report user with reason, description, screenshot' },
  { name: 'two-factor-auth', route: '/settings/two-factor/', file: 'src/routes/settings/two-factor/index.tsx', desc: '2FA with TOTP, backup codes, QR' },
  { name: 'phone-login', route: '/phone-login/', file: 'src/routes/phone-login/index.tsx', desc: 'Phone login with OTP, verification' },
  { name: 'circles', route: '/circles/', file: 'src/routes/circles/index.tsx', desc: 'Circles with friends, groups, proximity' },
  { name: 'boost', route: '/boost/', file: 'src/routes/boost/index.tsx', desc: 'Boost with 30min visibility, super boost 10x, consumable 2.99€' },
  { name: 'photo-editor', route: '/photo-editor/', file: 'src/routes/photo-editor/index.tsx', desc: 'Photo editor with crop, filter, blur, AI enhancer' },
  { name: 'video-roulette', route: '/video-roulette/', file: 'src/routes/video-roulette/index.tsx', desc: 'Video roulette with random matching, WebRTC' },
  { name: 'photo-verification', route: '/verify/photo/', file: 'src/routes/verify/photo/index.tsx', desc: 'Photo verification with selfie, liveness, badge' },
  { name: 'data-export', route: '/settings/data-export/', file: 'src/routes/settings/data-export/index.tsx', desc: 'Data export GDPR with JSON, ZIP, media' },
  { name: 'media-settings', route: '/settings/media/', file: 'src/routes/settings/media/index.tsx', desc: 'Media settings with auto-play, quality, cache' },
  { name: 'location-settings', route: '/settings/location/', file: 'src/routes/settings/location/index.tsx', desc: 'Location settings with geohash, hide real GPS, travel mode' },
  { name: 'language-settings', route: '/settings/language/', file: 'src/routes/settings/language/index.tsx', desc: 'Language settings with i18n, locale' },
  { name: 'accessibility-settings', route: '/settings/accessibility/', file: 'src/routes/settings/accessibility/index.tsx', desc: 'Accessibility WCAG 2.2 AA with font size, contrast' },
  { name: 'permissions', route: '/settings/permissions/', file: 'src/routes/settings/permissions/index.tsx', desc: 'Permissions with camera, mic, location, notifications' },
  { name: 'community-challenges', route: '/community-challenges/', file: 'src/routes/community-challenges/index.tsx', desc: 'Community challenges with XP, streak, leaderboard' },
  { name: 'login', route: '/login/', file: 'src/routes/login/index.tsx', desc: 'Login with email, phone, OAuth, 2FA' },
];

for (const screen of screens) {
  const dir = path.dirname(`/home/user/fyk-consolidated/${screen.file}`);
  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(`/home/user/fyk-consolidated/${screen.file}`)) {
    console.log(`Exists ${screen.name}, skipping`);
    continue;
  }

  const componentName = screen.name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Screen';

  const content = `import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/primitives";

export const Route = createFileRoute("${screen.route}")({
  component: ${componentName},
});

function ${componentName}() {
  const { data, isLoading } = useQuery({
    queryKey: ["${screen.name}"],
    queryFn: async () => ({
      items: Array.from({ length: 6 }, (_, i) => ({
        id: \`\${"${screen.name}"}-\${i}\`,
        title: \`\${"${screen.name}"} \${i + 1}\`,
        description: "${screen.desc}",
      })),
    }),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl p-4"><Skeleton className="h-[200px] rounded-[20px]" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24">
      <div className="mb-6 rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm">
        <h1 className="font-display text-[24px] font-bold tracking-tight text-black capitalize">${screen.name.replace(/-/g, ' ')}</h1>
        <p className="mt-1 text-[14px] text-zinc-500">${screen.desc}</p>
      </div>
      <div className="grid gap-3">
        {data?.items.map((item) => (
          <div key={item.id} className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm">
            <p className="font-medium text-black">{item.title}</p>
            <p className="mt-1 text-[13px] text-zinc-500">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

  fs.writeFileSync(`/home/user/fyk-consolidated/${screen.file}`, content, 'utf8');
  console.log(`Generated ${screen.name}`);
}
