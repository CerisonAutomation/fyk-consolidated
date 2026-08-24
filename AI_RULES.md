# AI_RULES.md

## Tech Stack

- **React 19** with TypeScript (strict mode enabled). Use modern React patterns — no class components.
- **TanStack Start** (full-stack React framework built on TanStack Router). This is NOT Next.js — it uses file-based routing via `@tanstack/react-router` with SSR support through `@tanstack/react-start`.
- **TanStack Router** for routing. Routes live in `src/routes/` and are defined with `createFileRoute()` or `createRootRouteWithContext()`. The route tree is auto-generated via `tsr generate` — never manually edit `src/routeTree.gen.ts`.
- **TanStack Query** (`@tanstack/react-query`) for server-state management, data fetching, and caching. Client is provided in `src/integrations/tanstack-query/root-provider.tsx`. Use `useQuery` / `useMutation` for any data fetching.
- **TanStack Store** (`@tanstack/store` + `@tanstack/react-store`) for lightweight client-only global state. NOT Redux, NOT Zustand — use `Store` from `@tanstack/store`.
- **TanStack Table** (`@tanstack/react-table`) for data tables with sorting, filtering, and pagination.
- **TanStack AI** (`@tanstack/ai`, `@tanstack/ai-react`, `@tanstack/ai-client`) for AI/chat features. Multi-provider support (Anthropic, OpenAI, Gemini, Ollama). Server-side chat handlers are API routes in `src/routes/demo/api.ai.*.ts`. Client-side chat hook is built with `createChatClientOptions` + `useChat`.
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin. Style tokens are CSS custom properties defined in `src/styles.css` — use `var(--token-name)` or the Tailwind `color-*` references. Dark mode uses `.dark` class variant.
- **shadcn/ui** (new-york style, zinc base) for UI primitives. Components live in `src/components/ui/`. Alias `#/components/ui` in `components.json`. All shadcn/ui components are already installed — never run `npx shadcn@latest add`.
- **Prisma** with `@prisma/adapter-pg` (Neon/PostgreSQL driver adapter) for the database layer. Client singleton in `src/db.ts`. Schema in `prisma/schema.prisma`. Use `prisma db push` for prototyping, `prisma migrate dev` for migrations.
- **better-auth** for authentication with `tanstack-start` cookie integration. Config in `src/lib/auth.ts`, client in `src/lib/auth-client.ts`.
- **Vite 8** as the build tool with `@vitejs/plugin-react` and `@tanstack/devtools-vite`.
- **Biome** for formatting (tabs, double quotes) and linting. NOT Prettier, NOT ESLint — run `pnpm check` or `pnpm format`/`pnpm lint`.
- **Zod** for runtime schema validation and type inference.
- **Faker.js** (`@faker-js/faker`) for generating mock/demo data.

## Library Rules

### Routing & Navigation
- Use `createFileRoute('/path')` for page components in `src/routes/`.
- Use `createRootRouteWithContext()` only in `__root.tsx` for the app shell with typed context.
- All routes MUST be in `src/routes/`. File-based routing maps files to URL paths.
- API route handlers use `server: { handlers: { POST/GET: ... } }` export on the route definition.
- Use `Link` from `@tanstack/react-router` for navigation (enables preloading).
- After adding routes, run `pnpm generate-routes` to update the route tree.

### Data Fetching & Server State
- Use `useQuery` / `useMutation` from `@tanstack/react-query` for all async data.
- Use `useSuspenseQuery` when the component tree is wrapped in `<Suspense>`.
- Never fetch data in `useEffect` — use React Query's `queryFn`.

### Client State
- Use `Store` from `@tanstack/store` for simple global state (not React Context).
- Use `useStore` from `@tanstack/react-store` to subscribe components to store changes.
- Keep stores small and focused — one concern per store.

### AI Features
- Server-side: Import `chat`, `toServerSentEventsResponse` from `@tanstack/ai`. Define adapter using `anthropicText`, `openaiText`, `geminiText`, or `ollamaText`.
- Client-side: Use `createChatClientOptions` + `useChat` from `@tanstack/ai-react`.
- Tools are split into server tools (have `execute`) and client tools (have `client()` definition).
- Multi-provider pattern: check env vars for API keys, fall through to Ollama as local fallback.

### Styling
- Use Tailwind utility classes as the primary styling mechanism.
- Reference design tokens via CSS custom properties: `text-[var(--sea-ink)]`, `bg-[var(--chip-bg)]`, etc.
- For shadcn/ui components, use the semantic color classes: `text-foreground`, `bg-card`, `border-border`, etc.
- Use `class-variance-authority` (cva) for component variant definitions.
- Use `tailwind-merge` (via `cn()` from `#/lib/utils`) to merge Tailwind classes.
- Never use inline `style` for layout — use Tailwind utilities.
- Global custom classes (`.island-shell`, `.feature-card`, `.page-wrap`, `.display-title`, `.island-kicker`) are defined in `src/styles.css` and provide the app's visual identity.

### Database
- Import `prisma` from `#/db` (singleton, never create new PrismaClient instances).
- Prisma schema is the source of truth in `prisma/schema.prisma`.
- Run `pnpm db:generate` after schema changes to regenerate the Prisma client.
- The generated client lives in `src/generated/prisma/` — import from `#/generated/prisma/client.js`.

### Auth
- Use `authClient` from `#/lib/auth-client` for client-side auth operations (sign in, sign up, session).
- Use `auth` from `#/lib/auth` for server-side auth configuration and verification.
- Auth is configured via `better-auth` with email/password and TanStack Start cookie plugin.

### Icons
- Use `lucide-react` for all icons. Import as `import { IconName } from 'lucide-react'`.
- Never create custom SVG icons when a Lucide equivalent exists.

### Forms & Validation
- Use `zod` for validation schemas. Infer TypeScript types with `z.infer<typeof schema>`.
- For server-side validation, validate request bodies with Zod before processing.

### Data Tables
- Use `@tanstack/react-table` with `@tanstack/match-sorter-utils` for fuzzy filtering.
- Always provide `getCoreRowModel()` — other models are optional based on features needed.

### Code Quality
- Biome formatter: tabs for indentation, double quotes for strings.
- Biome linter: recommended rules only — no custom overrides.
- TypeScript strict mode: no `any`, no `@ts-ignore`, no non-null assertions where avoidable.
- Use path aliases: `#/` maps to `src/` (preferred), `@/` also works.
- Export types alongside their implementations. Use `export type` for type-only exports.
- Never modify generated files: `routeTree.gen.ts`, `src/generated/prisma/`.

### File Organization
- Routes: `src/routes/`
- Shared components: `src/components/`
- UI primitives (shadcn/ui): `src/components/ui/`
- Core business logic & models: `src/core/`
- Custom hooks: `src/hooks/`
- Domain logic: `src/domains/`
- Integration wiring: `src/integrations/`
- Lib utilities: `src/lib/`
- Data files: `src/data/`
- API/client code: `src/core/api/`
