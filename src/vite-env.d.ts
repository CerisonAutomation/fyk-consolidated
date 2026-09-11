/// <reference types="vite/client" />

/**
 * Loads TanStack Start's ambient route types.
 *
 * Start adds the `server.handlers` option to file routes by declaration
 * merging into the router's `FilebaseRouteOptionsInterface`. Without this
 * reference `src/routes/api/$.ts` — the single API entry point — does not type
 * check, and its handler arguments silently degrade to `any`, which is exactly
 * how a request-shaped bug would hide.
 */
/// <reference types="@tanstack/react-start" />
