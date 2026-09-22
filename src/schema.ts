/**
 * Server-only re-export of the Drizzle schema.
 *
 * Exists so route modules can `import { events, users } from "@/schema"`
 * instead of reaching outside `src/` with `../../../drizzle/...` paths, and so
 * the schema has exactly one client-invisible entry point: this file is
 * imported solely from `src/routes/api/**` and `#/db`, both server-side.
 */
export * from "../drizzle/schema";
