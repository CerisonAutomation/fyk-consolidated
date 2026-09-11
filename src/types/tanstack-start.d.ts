/**
 * Loads TanStack Start's route-option augmentation.
 *
 * `server.handlers` on a route is declared by `@tanstack/start-client-core`
 * through `declare module "@tanstack/router-core"`. Declaration merging is
 * program-global, but only once that declaration file is part of the program —
 * and nothing in `src/` imports `@tanstack/react-start` (the Vite plugin
 * supplies the runtime entry points), so TypeScript never saw the augmentation
 * and rejected `server` as an unknown property on every API route.
 *
 * Type-only import: erased at compile time, adds nothing to any bundle.
 */
import type {} from "@tanstack/react-start";
