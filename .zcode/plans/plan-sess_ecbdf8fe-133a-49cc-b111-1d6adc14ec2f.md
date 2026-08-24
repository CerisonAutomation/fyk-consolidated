## TanStack Boilerplate Audit & Update — Core Pages

### Phase 1: Wire TanStack Query Provider
- Rewrite `src/integrations/tanstack-query/root-provider.tsx` — make `TanstackQueryProvider` a real component wrapping children with `<QueryClientProvider>`
- Wrap app in `src/routes/__root.tsx` with the provider

### Phase 2: Fix Navigation (All `<a>` → `<Link>`)
- NavBar: convert all `<a>` to `<Link>`, remove `onNavigate` prop
- Grid: profile links → `<Link>`
- Chat list: conversation links → `<Link>`
- Chat detail: back link → `<Link>`
- Profile page: all links → `<Link>`
- Taps: profile links → `<Link>`
- Views: profile links → `<Link>`
- Settings hub: all 4 nav links → `<Link>`
- Settings account: **fix route bug** (`/settings/account/blocked` → `/settings/blocked`) + convert to `<Link>`
- Settings app/profile/privacy/blocked/hidden: back links → `<Link>`
- Sign-in: `window.location.href` → `navigate()`, sign-up link → `<Link>`
- Onboarding: `window.location.href` → `navigate()`

### Phase 3: Add Route Loaders
- Grid: add loader calling `useGridStore.getState().load(geohash)`, remove `useEffect`
- Chat list: add loader, remove `useEffect`
- Chat detail: add loader to ensure conversations loaded + set active, remove `useEffect`
- Taps: add loader, remove `useEffect`
- Profile: add loader using `useProfile` hook, remove hardcoded mock data

### Phase 4: Wire Settings to Preferences
- Create `usePreferences` hook
- App Settings: wire 4 toggles + units select to preferences store
- Privacy Settings: wire toggle to account preferences
- Profile Edit: wire form to `useProfile` + `usePatchProfile`

### Phase 5: Stub Pages → Real Data
- Views: wire to `useViews()`
- Blocked Users: wire to `useBlockedUsers()`
- Hidden Users: wire to `useHiddenUsers()`

### Out of Scope
- Zustand → TanStack Store migration (large independent task)
- Auth guards / beforeLoad (requires real auth implementation)
- Right Now page (placeholder, no action)