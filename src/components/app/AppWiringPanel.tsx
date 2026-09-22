/**
 * AppWiringPanel — Wires all canonical hooks to ensure deadcode is connected
 * Hexagonal: hooks -> components -> routes, no unused exports
 */

import {
  useAppConfig,
  useMultiAccount,
  useWishlist,
  usePhotoScores,
  useAI,
  useChatEnhancements,
  useSpeedDating,
  useCalendar,
  useStats,
  useConsumables,
  useGridPresets,
  useCompatibility,
  useSafety,
  useOfflineQueue,
  useAppReady,
  useScheduledMessages,
} from "#/hooks/app-hooks";

export function AppWiringPanel() {
  const appConfig = useAppConfig();
  const multiAccount = useMultiAccount();
  const wishlist = useWishlist();
  const photoScores = usePhotoScores();
  const ai = useAI();
  const chatEnh = useChatEnhancements("wiring-check");
  const speedDating = useSpeedDating();
  const calendar = useCalendar();
  const stats = useStats();
  const consumables = useConsumables();
  const gridPresets = useGridPresets();
  const compat = useCompatibility();
  const safety = useSafety();
  const offline = useOfflineQueue();
  const appReady = useAppReady();
  const scheduled = useScheduledMessages();

  return (
    <div className="border rounded-xl p-4 space-y-3 text-xs">
      <h3 className="font-semibold text-sm">App Wiring — Deadcode Connected</h3>
      <div className="grid grid-cols-2 gap-2">
        <div>AppConfig: {appConfig.discreetIcon} locked={String(appConfig.isLocked)}</div>
        <div>MultiAccount: {multiAccount.accounts.length} accounts</div>
        <div>Wishlist: {wishlist.wishlist ? "loaded" : "none"} top={wishlist.topItems.length}</div>
        <div>PhotoScores: {photoScores.scores.length} avg={Math.round(photoScores.averageAppeal)}</div>
        <div>AI: {ai.conversations.length} convs usage={Object.keys(ai.usage).length}</div>
        <div>ChatEnh: {chatEnh.pinned.length} pinned</div>
        <div>SpeedDating: {speedDating.events.length} events</div>
        <div>Calendar: {calendar.events.length} events free={calendar.freeSlots.length}</div>
        <div>Stats: replyRate={Math.round(stats.replyRate)} best={stats.bestPhoto ? "yes" : "no"}</div>
        <div>Consumables: {Object.keys(consumables.inventory).length} skus</div>
        <div>GridPresets: quick={gridPresets.quickPresets.length} saved={gridPresets.savedPresets.length}</div>
        <div>Compat: {compat.scores.length} scores</div>
        <div>Safety: {safety.emergencyShares.length} shares deletion={safety.deletionRequest ? "pending" : "none"}</div>
        <div>Offline: {offline.pending.length} pending</div>
        <div>AppReady: {String(appReady.isReady)}</div>
        <div>Scheduled: {scheduled.scheduled.length} scheduled due={scheduled.due.length}</div>
      </div>
    </div>
  );
}
