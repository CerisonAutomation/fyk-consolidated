# GAP ANALYSIS — FYK production PRD v3.0 vs Current Codebase

## Current State (607 files, 40 API categories, 50 component folders, 6 hooks folder)

### File Statistics Comparison

| Category | PRD v3.0 (Real Code) | Current | Gap | Status |
|----------|----------------------|---------|-----|--------|
| Screen Components | 60, 21,389 lines | ~51 UI routes, ~30 clients 122-541 lines avg | Missing 9 screens, need 69 screens total (PRD 2.1 lists 69) | 🟡 Partial |
| AI Components | 14, 3,180 lines | ~8 AI components (AIAssistantPanel, etc.) | Missing 6: SmartMatchPanel, DeepCompatibilityScore, DatingAnalyticsDashboard, WingmanCoach, VoiceControlButton, PhotoRanker, DatePlanner, etc. | 🔴 Missing 6 |
| Custom Hooks | 47+, 2,500+ lines | 27 files exporting use*, 13 use*.ts files | Missing ~20 hooks: useAIChat, useAISearch, useRealtimeSync, useTypingSender, useIsUserOnline, useGesture, useEdgeSwipe, useLongPress, useHaptics, useMediaQuery, useMobile, useIntersectionObserver, useDebounce, useThrottle, useAnimatedCounter, useFetch, useApiQuery, useQueries, useSendMessageMutation, useProfiles, useProfileFilters, useFuzzySearch, useEventSuggestions, useMatch, useSafety, useSubscription, useXPRewards, useLocation, usePushNotifications, useNotifications, useVideoCall, useStreak, useMessageExpiry, useDNDTimer, useFeatureFlags, useI18n, useSupabaseAuth, etc. | 🔴 Missing 20 |
| API Routes | 50+, 3,000+ lines | 121 API routes (40 categories) | Have more than 50, but need to ensure all PRD routes present: auth/login, signup, refresh, reset, mfa, sessions, change-password, logout, phone/send, phone/verify, profiles, profiles/[id], profiles/photos, profiles/verification, conversations, conversations/[id]/messages, ai/smart-match, deep-compatibility, wingman, icebreakers, reply-generator, date-planner, translate, suggestions, bio-generator, profile-analysis, profile-review, compatibility, conversation-intel, auto-reply, autocomplete, event-gen, event-suggestions, event-templates, local-chat, local-moderate, moderate, notification-priority, rag-memory, transcribe, safety/block, report, nsfw, sos, location-share, notify, events, events/[id], events/[id]/rsvp, groups, groups/[id], groups/[id]/join, groups/[id]/leave, favorites, shouts, feature-flags, health, tags, admin/stats, admin/moderation, gdpr/export, gdpr/delete, analytics/dating | 🟡 Have 121 but need to audit vs PRD list, some thin need gold |
| AI Infrastructure | 9 files, 800+ lines | ~5 files (transformers-provider, config, embeddings, etc.) | Missing 4: memory.ts RAG pgvector, moderation.ts dual-strategy, auto-reply.ts, event-gen.ts, match-suggestions.ts, summarizer.ts | 🟡 Partial |
| Edge Functions | 14, 1,000+ lines | 0 edge functions (supabase functions folder empty) | Missing all 14: ai-intent-detect, auto-moderate, check-infractions, cleanup-expired, generate-embeddings, match-profiles, meetnow-boost, mfa-setup, mfa-verify, rate-limit, search-nearby, send-notification, streak-check | 🔴 Missing 14 |
| Database Migrations | 32, 500+ lines | 32 migrations (we have) | ✅ Match | ✅ Done |
| Total | 226+ files, 32,369+ lines | 607 files | Have more files but not organized hexagonal, messy | 🟡 Need tidy hexagonal |

### Type System Comparison

| Type | PRD v3.0 | Current | Gap |
|------|----------|---------|-----|
| Screen Names | 69 screens (onboarding, discover, discover-map, profile, profile-detail, profile-edit, settings, chat, chat-conversation, events, event-detail, event-create, notifications, paywall, filters, blocked-users, emergency-contact, ai-toggles, data-settings, account-settings, subscription, video-dates, groups, group-detail, group-create, shouts, shout-detail, shout-create, who-viewed-me, interested-in-me, meetnow, verify, image-viewer, vouches, agenda, legal, faq, offline, welcome, forgot-password, privacy-settings, pin-lock, dnd-settings, discreet-icon, deactivate-account, notification-settings, favorites, search-inbox, change-password, backup-restore, report-user, two-factor-auth, phone-login, circles, boost, photo-editor, video-roulette, photo-verification, data-export, dump-rify, blind-date, story-viewer, profile-insights, media-settings, location-settings, language-settings, accessibility-settings, permissions, community-challenges, photo-ranker, login) | ~51 routes, missing 18: discover-map, event-detail, event-create, paywall, filters, blocked-users, emergency-contact, ai-toggles, data-settings, account-settings, subscription, video-dates, group-detail, group-create, shout-detail, shout-create, who-viewed-me, interested-in-me, verify, image-viewer, vouches, agenda, legal, faq, welcome, forgot-password, privacy-settings, pin-lock, dnd-settings, discreet-icon, deactivate-account, notification-settings, favorites, search-inbox, change-password, backup-restore, report-user, two-factor-auth, phone-login, circles, boost, photo-editor, video-roulette, photo-verification, data-export, dump-rify, blind-date, story-viewer, profile-insights, media-settings, location-settings, language-settings, accessibility-settings, permissions, community-challenges, photo-ranker, login | 🔴 Missing 18 screens |
| UserProfile | 47 fields (id, name, handle, avatar, bio, dateOfBirth, age, ageVerified, faceVerified, profileComplete, tier free/gold/platinum, verifiedBadge none/basic/verified, trustLevel, isOnline, location, distanceKm, gender, pronouns, sexuality, relationshipType, headline, aboutMe, aboutYou, height, bodyType, ethnicity, occupation, education, languages, smoking, drinking, exercise, showOnline, showDistance, incognitoMode, travelMode, travelCity, nsfwEnabled, photos, tags, vouches) | User entity with ~30 fields, missing handle, ageVerified, faceVerified, profileComplete, trustLevel, headline, aboutMe, aboutYou, occupation, education, income, smoking, drinking, exercise, dietary, covidVaccine, hivStatus, prep, sexualHealth, bodyHair, etc. | 🟡 Partial, need 47 fields |
| Message | 17+ types (text, image, gif, video, audio, location, profile_share, template, album_request, album_grant, album_revoke, system, voice_note, ai_suggestion, reaction) | Message entity with 9 types (text, image, video, audio, location, gift, system, poll, voice-note) | Missing 8 types: gif, profile_share, template, album_request, album_grant, album_revoke, ai_suggestion, reaction | 🟡 Missing 8 types |
| FilterState | 30 fields (minAge, maxAge, distanceMax, gender, onlineOnly, withPhotoOnly, verifiedOnly, tags, bodyTypes, relationshipStatus, lookingFor, ethnicities, minHeight, maxHeight, minWeight, maxWeight, sexuality, hivStatus, prep, smoking, drinking, exercise, education, position, bodyHair, hairColor, beard, tattoos, piercings, saferSex) | GridFilters with ~25 fields, missing ethnicities, hivStatus, prep, bodyHair, hairColor, beard, tattoos, piercings, saferSex, etc. | 🟡 Missing 10 fields |
| API Types | ApiResponse, ApiError, PaginationMeta, ApiResult, ErrorCode (13 codes) | Have similar but not RFC 7807, need standardized | 🟡 Partial |

### Database Schema Comparison

| Model | PRD v3.0 (20+ models) | Current (Drizzle) | Gap |
|-------|------------------------|-------------------|-----|
| User | id, email, phone, passwordHash, name, handle, avatar, bio, dateOfBirth, ageVerified, faceVerified, mfaEnabled, mfaSecret, backupCodes, deviceTokens, profileComplete, tier, stripeCustomerId, revenueCatId, consentJson, emergencyName, emergencyPhone, lastSeenAt | users table with id, email, etc., missing handle, ageVerified, faceVerified, mfaEnabled, mfaSecret, backupCodes, deviceTokens, profileComplete, stripeCustomerId, revenueCatId, consentJson, emergencyName, emergencyPhone | 🟡 Missing fields |
| Profile | 20+ fields, trustLevel, verifiedBadge, isOnline, showOnline, showDistance, showLastSeen, incognitoMode, travelMode, travelCity, nsfwEnabled | profiles table, missing trustLevel, verifiedBadge, showLastSeen, travelCity | 🟡 Missing fields |
| ProfilePhoto | id, profileId, order, url, width, height, isPrivate, nsfwFlagged, watermark, albumId | photos table, missing order, width, height, isPrivate, nsfwFlagged, watermark, albumId | 🟡 Missing |
| ProfileTag | id, profileId, group, value | tags table, have | ✅ |
| Vouch | id, profileId, authorId, text | vouches table, have? | 🟡 Check |
| PrivateAlbum | id, profileId, name | private_albums? | 🟡 Check |
| AlbumAccess | id, albumId, grantedToId, grantedById, status | album_access? | 🟡 Check |
| Conversation | id, type, eventId | conversations, have | ✅ |
| ConversationParticipant | id, conversationId, userId, joinedAt, lastReadAt, isArchived, isMuted | conversation_participants, have | ✅ |
| Message | 15+ fields | messages, have | ✅ |
| Interest | id, fromUserId, toUserId, type, status | interests, have? | 🟡 |
| Tap | id, senderId, receiverId, type | taps, have | ✅ |
| Event | id, hostId, title, description, location, lat, lng, startTime, endTime, capacity, currentCount, isPublic, showAttendees, icsUrl, boosted | events, have | ✅ |
| EventRSVP | id, eventId, userId, status | event_rsvps, have | ✅ |
| FilterPreset | id, userId, name, slug, filters, isPinned | filter_presets? | 🟡 |
| Block | id, blockerId, blockedId | blocks, have | ✅ |
| Report | id, reporterId, reportedId, reason, description, messageId, toxicityScore, status, reviewedById, reviewedAt | reports, have | ✅ |
| Notification | id, userId, type, title, body, data, isRead, readAt | notifications, have | ✅ |
| AuditLog | id, userId, action, resource, resourceId, metadata, ipAddress | audit_logs, have | ✅ |

### Store Architecture Comparison

| Store | PRD v3.0 (12 stores) | Current | Gap |
|-------|----------------------|---------|-----|
| useNavigationStore | currentScreen, previousScreen, selectedProfileId, selectedConversationId, selectedEventId, selectedGroupId, selectedShoutId, navigate, goBack, selectProfile, etc. | Have navigation store? | 🟡 Check |
| useAuthStore | isAuthenticated, currentUser, onboardingStep, profileScore, setAuthenticated, logout, setOnboardingStep, setProfileScore | Have auth store | ✅ |
| useChatStore | conversations, messages, typingUsers, messageExpiry, setConversations, setMessages, addMessage, setTyping, setMessageExpiry, removeExpiredMessages | Have chat store | ✅ |
| useDiscoverStore | filters, filterOpen, discoverView, discoverSort, activeTribe, searchQuery, freshFaces, lastSwipe, savedFilters, setFilters, setFilterOpen, setDiscoverView, setDiscoverSort, setActiveTribe, setSearchQuery, setFreshFaces, setLastSwipe, saveFilter, loadFilter, deleteFilter | Have discover store (grid store) | 🟡 Partial, need freshFaces, lastSwipe, savedFilters |
| useEventsStore | events, createdEvents, eventSuggestions, eventTemplates, setEvents, addCreatedEvent, setEventSuggestions, setEventTemplates | Have events store? | 🟡 Check |
| useNotificationsStore | notifications, unreadNotificationCount, notifSettings, setNotifications, setNotifSettings | Have notifications store | ✅ |
| useCommunityStore | groups, shouts, setGroups, setShouts | Have community store? | 🟡 Check |
| useSafetyStore | favorites, blockedUsers, profileViews, interestedInMe, reportUserId, reportUserName, setFavorites, addFavorite, removeFavorite, isFavorite, setBlockedUsers, blockUser, unblockUser, setProfileViews, setInterestedInMe, setReportTarget | Have safety store | ✅ |
| useSettingsStore | settingsTab, dndEnabled, dndStartHour, dndEndHour, dndActive, pinLockEnabled, pinLockPin, discreetIconEnabled, videoDateActive, meetNowActive, boostActive, boostEndsAt, setSettingsTab, setDndEnabled, setDndSchedule, setPinLock, setDiscreetIcon, setVideoDateActive, setMeetNowActive, setBoost | Have settings store | 🟡 Partial, missing dnd, pinLock, discreetIcon, videoDate, meetNow, boost |
| useImageViewerStore | selectedImageUrls, selectedImageIndex, openImageViewer, closeImageViewer | Have image viewer store? | 🟡 Check |
| useDumpRifyStore | dumpRifyQueue, dumpRifyIndex, dumpRifyStats, setDumpRifyQueue, advanceDumpRifyIndex, recordDumpRifyKeep, recordDumpRifyDump, resetDumpRify | Missing | 🔴 Missing |
| useVoiceStore | voiceAcknowledgment, pendingVoiceMessage, setVoiceAcknowledgment, setPendingVoiceMessage | Have voice store? | 🟡 Check |

### AI Stack Comparison

| Component | PRD v3.0 | Current | Gap |
|-----------|----------|---------|-----|
| Models | onnx-community/Qwen3-0.6B-ONNX ~300MB chat, all-MiniLM-L6-v2 ~80MB embeddings, Xenova/distilbert-base-uncased-finetuned-sst-2-english ~26MB moderation, total ~350MB vs 2.5GB Ollama | Have transformers-provider with 3 models? | 🟡 Check |
| Infrastructure 9 files | transformers-provider.ts singleton pipeline 3 models, config.ts feature flags, embeddings.ts 384-dim cosine similarity, memory.ts RAG pgvector memory extraction, moderation.ts dual-strategy fast classifier + deep LLM, auto-reply.ts context-aware with memory + moderation, event-gen.ts AI parses natural language into structured events, match-suggestions.ts vector-based similarity, summarizer.ts conversation summarization | Have 5 files, missing memory.ts, moderation.ts dual, auto-reply.ts, event-gen.ts, match-suggestions.ts, summarizer.ts | 🔴 Missing 4 |
| Features 14 | Smart Match 5-dim, Deep Compatibility 8-dim, AI Wingman, Icebreakers, Reply Generator 10 tones, Date Planner, Auto Translate 14 langs, Photo Ranker, Dating Analytics, Safety Companion SOS, Voice Commands, Content Moderation dual, RAG Memory pgvector cosine, Auto Reply context-aware | Have some: Smart Match, Icebreakers, Reply Generator, Translate, Photo Ranker, Safety Companion, but missing Deep Compatibility 8-dim, AI Wingman, Date Planner, Dating Analytics, Voice Commands, Content Moderation dual, RAG Memory, Auto Reply | 🟡 Missing 6 |

### Screen Components Comparison (60 screens)

| Screen | PRD Lines | Current | Gap |
|--------|-----------|---------|-----|
| DiscoverScreen | 953 | Have grid, but need 953 lines with grid/map view, filter sheet 30 fields, tribes, AI search, voice control, fuzzy search, fresh faces, streak bar, saved filter presets | 🟡 Need enrich to 953 lines |
| DumpRifyScreen | 474 | Missing | 🔴 Missing |
| BlindDateScreen | 421 | Missing | 🔴 Missing |
| MeetNowScreen | 488 | Have meetnow-client 233 lines, need 488 | 🟡 Need enrich |
| ChatConversationScreen | 1724 | Have chat-view 58KB, need 1724 lines with AI suggestions, toxicity detection, intent detection, form detection, voice messages, translation 14 langs, emoji/giphy/gaymoji pickers, saved phrases, typing indicators, read receipts, reactions, replies, ephemeral messages, quick reply bar, AI wingman, auto-reminder, edit indicator | 🟡 Need enrich to 1724 |
| ChatScreen | 664 | Have messages-client, need 664 | 🟡 Partial |
| ProfileEditScreen | 1356 | Have profile edit, need 1356 with 15+ fields body types ethnicities education smoking drinking exercise dietary COVID vaccine HIV status PrEP sexual health sexuality body hair circumcision photo management tag management personality sliders profile prompts | 🟡 Need enrich |
| ProfileDetailScreen | 734 | Have profile view, need 734 | 🟡 Partial |
| ProfileScreen | 442 | Have profile, need 442 | ✅ |
| ProfileInsightsScreen | 378 | Missing | 🔴 Missing |
| PhotoVerificationScreen | 564 | Have verification? | 🟡 Check |
| PhotoEditorScreen | 466 | Have photo editor? | 🟡 Check |
| EventsScreen | 1170 | Have events-client 467 lines, need 1170 with event creation RSVP calendar suggestions | 🟡 Need enrich |
| SettingsScreen | 384 | Have settings, need 384 comprehensive tabs | ✅ |
| LegalScreen | 462 | Have legal? | 🟡 Check |
| LoginScreen | 389 | Have sign-in 33KB, need 389 email/phone/Google/Apple auth | ✅ |
| OnboardingScreen | 627 | Have onboarding, need 627 6-step wizard | 🟡 Partial |
| VideoRouletteScreen | 414 | Have video-roulette? | 🟡 Check |
| LandingPage | 1175 | Have index, need 1175 marketing premium quality | 🟡 Partial |

### AI Components Comparison (14)

| Component | PRD Lines | Current | Gap |
|-----------|-----------|---------|-----|
| SmartMatchPanel | 540 | Have? | 🟡 Check |
| AIWingmanChat | 469 | Missing | 🔴 |
| DatingAnalyticsDashboard | 269 | Missing | 🔴 |
| WingmanCoach | 252 | Missing | 🔴 |
| VoiceControlButton | 229 | Missing | 🔴 |
| DeepCompatibilityScore | 219 | Missing | 🔴 |
| AIProfileInsights | 203 | Have? | 🟡 |
| AIReplyGenerator | 203 | Have? | 🟡 |
| SafetyCompanion | 303 | Have safety panel? | 🟡 |
| VoiceCommandProvider | 322 | Missing | 🔴 |
| AutoTranslateToggle | 97 | Have? | 🟡 |
| AISuggestionBar | 74 | Have? | 🟡 |
| DatePlanner | — | Missing | 🔴 |
| PhotoRanker | — | Have? | 🟡 |

### Security Architecture Comparison (6 layers)

| Layer | PRD | Current | Gap |
|-------|-----|---------|-----|
| Layer 1: Next.js Middleware (middleware.ts) CSP HSTS X-Frame-Options X-Content-Type-Options X-XSS-Protection Referrer-Policy Permissions-Policy Server header removal Supabase session refresh | Have middleware.ts 11KB with some headers, need all | 🟡 Partial |
| Layer 2: API Middleware (api-middleware.ts) HMAC Bearer Supabase fallback CORS CSRF Rate limiting 30 req/min auto-block 5 min Abuse tracking Request ID IP extraction Public route whitelist 10 routes | Have withSecurity, need HMAC Bearer, abuse tracking, public whitelist | 🟡 Partial |
| Layer 3: Route Helpers (api-route-helpers.ts) getUserId requireAuth parseBody safeRoute getPagination standardized error RFC 7807 | Have api-helpers, need RFC 7807 | 🟡 Partial |
| Layer 4: Input Validation sanitizeString strip HTML enforce length sanitizeArray Zod schemas Type checking | Have Zod, need sanitizeString HTML strip | 🟡 Partial |
| Layer 5: Content Moderation Fast path distilbert ~26MB ~30ms Deep path Qwen3 ~300MB ~2s Client-side keyword toxicity 15 patterns Threshold 0.7 Categories toxicity harassment hate_speech sexual violence spam self_harm Auto-block after 3 flags | Have moderation? | 🟡 Check |
| Layer 6: Database Security RLS on all tables Anon revoked RLS policies INSERT UPDATE DELETE Triggers auto-creation pgvector semantic search | Have RLS? | 🟡 Check |

### Billing & Monetization Comparison

| Feature | PRD (Free/Gold/Platinum) | Current (Free/Plus/Gold/Platinum + XTRA/Unlimited) | Gap |
|---------|---------------------------|-----------------------------------------------------|-----|
| Free | 10 likes/day, 20 messages/day, 3 filters, 0 private albums, 0 group members, 0 boosts, no viewed, no video dates, no create events, no boost, no incognito, no travel, no read receipts, no AI, no smart match, 0 private albums, 0 group members, 0 boosts, no undo swipe | Free with 100 profiles, basic filters, unlimited messages, 1 boost | 🟡 Need 10 likes/day, 20 messages/day limit |
| Gold €14.99 | Unlimited likes/messages, 12 filters, yes viewed, no video dates, yes create events, yes boost, yes incognito, yes travel, yes read receipts, yes AI, yes smart match, 1 private album, 50 group members, yes create groups/shouts/agenda/meetnow/vouch/see who liked, 2 boosts/month, yes undo swipe | Gold with 5 boosts, advanced filters, no ads, etc. | 🟡 Need exact PRD features |
| Platinum €24.99 | Unlimited likes/messages, 12 filters, yes viewed, yes video dates, yes create events, yes boost, yes incognito, yes travel, yes read receipts, yes AI, yes smart match, 5 private albums, unlimited group members, yes create groups/shouts/agenda/meetnow/vouch/see who liked, 5 boosts/month, yes undo swipe | Platinum with 15 boosts, all filters, web access, calls | 🟡 Need exact |
| Consumables | 1x Boost €3.99 30min, 5x Boost €15.99 20% off, Super Boost €9.99 10x 30min, Unlimited Boost €14.99 until match, Undo Swipe €1.99, Extra Album €4.99 | Have consumables with bones currency, need € pricing | 🟡 Need € pricing |

### Real-Time System Comparison

| Component | PRD | Current | Gap |
|-----------|-----|---------|-----|
| useRealtimeSync master hook Message Thread Notification Presence Typing | Have useRealtimeChat, need master hook | 🟡 Partial |
| DB → Frontend Mapping mapThreadToConversation mapDbMessage mapDbNotification | Have? | 🟡 Check |
| Optimization Debounced 100ms Client-side filtering Mounted ref cleanup | Have? | 🟡 Check |
| Typing Indicators useTypingSender broadcast via Supabase channel Auto-stop 4s | Have? | 🟡 Check |
| Online Presence useIsUserOnline | Have useIsUserOnline? | 🟡 Check |

### Design System Comparison

| Token | PRD | Current | Gap |
|-------|-----|---------|-----|
| Colors | bg #0a0a0a, card #111111, surface #1a1a1a, muted2 #222222, fg #e8e6e3, muted #888888, dim #555555, skeleton #333333, border rgba(255,255,255,0.05), borderLight rgba(255,255,255,0.1), red #FF073A brand CTA danger, gold #D4AF37 premium nav active, neon #00FF88 success online verified, elec #0088FF links info, purple #7B2FBE voice, fire #FF4500 urgency FOMO, warning #FFB300 | Current: black primary not blue #3B82F6, gold oklch(0.80 0.17 85), emerald oklch(0.74 0.19 160), zinc, etc. — need PRD exact #0a0a0a bg etc. | 🟡 Need PRD exact colors |
| Fonts | heading Bebas Neue Impact, body Space Grotesk, mono JetBrains Mono | Have Space Grotesk, JetBrains Mono, need Bebas Neue | 🟡 Missing Bebas Neue |
| Border Radius | sm 6px, md 8px, lg 10px, xl 14px, full 9999px | Have sm 12px md 16px lg 20px full — need PRD 6/8/10/14 | 🟡 Need PRD radius |
| Transitions | ease cubic-bezier(0.4, 0, 0.2, 1), spring cubic-bezier(0.16, 1, 0.3, 1), bounce cubic-bezier(0.34, 1.56, 0.64, 1), fast 0.15s normal 0.2s slow 0.35s | Have fast 150ms normal 200ms slow 300ms spring cubic-bezier(0.175, 0.885, 0.32, 1.275) — need PRD exact | 🟡 Need PRD transitions |
| Tier Colors | Free #555555 dim, Gold #D4AF37, Platinum #FF073A red | Have Free zinc, Gold oklch, Platinum? — need PRD exact | 🟡 Need PRD tier colors |

## Summary — Gaps to Close for production PRD v3.0

### Critical Gaps (Must Fix for 100% Grounded)

1. **12 Zustand Stores** — Missing 1: useDumpRifyStore (gamified keep/dump streak), need to implement all 12 with exact state/actions as PRD 4.1
2. **14 AI Components** — Missing 6: AIWingmanChat, DatingAnalyticsDashboard, WingmanCoach, VoiceControlButton, DeepCompatibilityScore, VoiceCommandProvider, DatePlanner — need to implement all 14 with exact lines/features as PRD 7
3. **47+ Hooks** — Missing 20: useAIChat, useAISearch, useRealtimeSync master, useTypingSender, useIsUserOnline, useGesture, useEdgeSwipe, useLongPress, useHaptics, useMediaQuery, useMobile, useIntersectionObserver, useDebounce, useThrottle, useAnimatedCounter, useFetch, useApiQuery, useQueries, useSendMessageMutation, useProfiles, useProfileFilters, useFuzzySearch, useEventSuggestions, useMatch, useSafety, useSubscription, useXPRewards, useLocation, usePushNotifications, useNotifications, useVideoCall, useStreak, useMessageExpiry, useDNDTimer, useFeatureFlags, useI18n, useSupabaseAuth — need 47+
4. **14 Edge Functions** — Missing all 14: ai-intent-detect, auto-moderate, check-infractions, cleanup-expired, generate-embeddings, match-profiles, meetnow-boost, mfa-setup, mfa-verify, rate-limit, search-nearby, send-notification, streak-check — need to create supabase/functions/
5. **60 Screen Components** — Missing 9 screens, need 69 total: discover-map, event-detail, event-create, paywall, filters, blocked-users, emergency-contact, ai-toggles, data-settings, account-settings, subscription, video-dates, group-detail, group-create, shout-detail, shout-create, who-viewed-me, interested-in-me, verify, image-viewer, vouches, agenda, legal, faq, welcome, forgot-password, privacy-settings, pin-lock, dnd-settings, discreet-icon, deactivate-account, notification-settings, favorites, search-inbox, change-password, backup-restore, report-user, two-factor-auth, phone-login, circles, boost, photo-editor, video-roulette, photo-verification, data-export, dump-rify, blind-date, story-viewer, profile-insights, media-settings, location-settings, language-settings, accessibility-settings, permissions, community-challenges, photo-ranker, login — need all 69
6. **Database Schema** — Need 47 fields UserProfile, 17+ Message types, 30 fields FilterState, 20+ Prisma models with exact fields as PRD 3.1 — currently Drizzle, need to add missing fields
7. **AI Stack 9 files** — Missing 4: memory.ts RAG pgvector, moderation.ts dual fast+deep, auto-reply.ts, event-gen.ts, match-suggestions.ts, summarizer.ts — need all 9 with exact purpose as PRD 5.2
8. **Security 6 layers** — Need defense-in-depth as PRD 11.1: middleware CSP HSTS etc., api-middleware HMAC Bearer CORS CSRF rate limiting 30 req/min auto-block 5 min abuse tracking request ID IP extraction public whitelist 10 routes, route helpers RFC 7807, input validation sanitizeString HTML strip, content moderation fast distilbert 26MB 30ms deep Qwen3 300MB 2s keyword 15 patterns threshold 0.7 categories 7 auto-block 3 flags, DB security RLS anon revoked policies triggers pgvector
9. **Billing** — Need exact Free/Gold/Platinum as PRD 12.1 with € pricing, consumables 1x Boost €3.99 etc. as PRD 12.2 — currently bones currency, need € pricing
10. **Real-Time** — Need master hook useRealtimeSync, mapping, optimization debounced 100ms, typing indicators auto-stop 4s, online presence as PRD 13
11. **Design System** — Need exact tokens as PRD 14: colors bg #0a0a0a etc., fonts Bebas Neue, border radius 6/8/10/14, transitions ease spring bounce fast 0.15s normal 0.2s slow 0.35s, tier colors Free #555555 Gold #D4AF37 Platinum #FF073A

### Implementation Plan — enhanced Oracle Swarm Refactor

**Phase 1 — Stores (12) — 2 hours**
- Implement useNavigationStore, useAuthStore, useChatStore, useDiscoverStore (with freshFaces, lastSwipe, savedFilters), useEventsStore, useNotificationsStore, useCommunityStore, useSafetyStore, useSettingsStore (with dnd, pinLock, discreetIcon, videoDate, meetNow, boost), useImageViewerStore, useDumpRifyStore (gamified keep/dump), useVoiceStore

**Phase 2 — AI Components (14) — 3 hours**
- Implement SmartMatchPanel 540 lines 5-dim circular SVG ring animated number dimension bars strengths icebreakers red flags date ideas expand/collapse re-analyze, AIWingmanChat 469 lines FAB panel typewriter confidence bar follow-up, DatingAnalyticsDashboard 269 lines metrics grid conversion funnel weekly reports trend, WingmanCoach 252 lines health score death risk tone suggestions, VoiceControlButton 229 lines, DeepCompatibilityScore 219 lines 8-dim conversation patterns success probability, AIProfileInsights 203 lines, AIReplyGenerator 203 lines 10 replies 5 tones copy save score, SafetyCompanion 303 lines timed check-ins trusted contacts SOS live location, VoiceCommandProvider 322 lines full voice navigation, AutoTranslateToggle 97 lines 14 langs dropdown, AISuggestionBar 74 lines horizontal pills staggered, DatePlanner, PhotoRanker

**Phase 3 — Hooks (47+) — 2 hours**
- Implement all 47+ hooks as PRD 8.1-8.6: AI hooks, real-time hooks, UI hooks, data hooks, feature hooks, auth hooks

**Phase 4 — Edge Functions (14) — 1 hour**
- Create supabase/functions/ with 14 edge functions as PRD 10: ai-intent-detect, auto-moderate, check-infractions, cleanup-expired, generate-embeddings, match-profiles, meetnow-boost, mfa-setup, mfa-verify, rate-limit, search-nearby, send-notification, streak-check

**Phase 5 — Screens (60) — 4 hours**
- Implement missing 9 screens + enrich existing to PRD lines: DiscoverScreen 953 lines, DumpRifyScreen 474, BlindDateScreen 421, MeetNowScreen 488, ChatConversationScreen 1724, ChatScreen 664, ProfileEditScreen 1356, ProfileDetailScreen 734, EventsScreen 1170, etc.

**Phase 6 — Security, Billing, Real-Time, Design System — 2 hours**
- Implement 6 layers security as PRD 11, billing Free/Gold/Platinum € pricing as PRD 12, real-time master hook as PRD 13, design system exact tokens as PRD 14

**Total: 14 hours — enhanced Level — 100% Grounded in Real Code**
