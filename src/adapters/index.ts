/**
 * Adapters barrel export.
 *
 * Server-side Prisma adapters are exported directly.
 * Browser adapters are namespaced to avoid polluting the top-level scope
 * with browser-only globals.
 *
 * Usage:
 *   import { createWalletRepository } from "#/adapters";
 *   import { browser } from "#/adapters";
 *   browser.browserGeoAdapter.getCurrentPosition();
 */

export * from "./prisma";
export * as browser from "./browser";
