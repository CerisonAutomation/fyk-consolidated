/**
 * UI Components — Barrel export, hexagonal architecture, canonical source
 * Professional naming, DRY, KISS
 */

// Core
export { Avatar } from "./Avatar";
export { CardHead } from "./CardHead";
export { Chip } from "./Chip";
export { Crown } from "./Crown";
export { EmptyState } from "./EmptyState";
export { Modal } from "./Modal";
export { DataModeNotice, Panel } from "./Panel";
export { ProgressRing, ProgressRing as Ring } from "./ProgressRing";
export { Reveal } from "./Reveal";
export { Switch, Switch as Toggle } from "./Switch";
export { ToastStack } from "./ToastStack";

// Pagination — POM pattern
export { Pagination, CursorPagination } from "./pagination/Pagination";

// Grid — Profile grid
export { ProfileGrid } from "./grid/ProfileGrid";
export type { GridProfile } from "./grid/ProfileGrid";

// Composer — Message composer
export { MessageComposer } from "./composer/MessageComposer";

// Safety — Safety panel
export { SafetyPanel } from "./safety/SafetyPanel";

// Profile — Preview card
export { ProfilePreviewCard } from "./profile/ProfilePreviewCard";
export type { ProfilePreview } from "./profile/ProfilePreviewCard";

// Primitives
export * from "./primitives";
