# URL State Management Patterns

> Source: TanStack Router documentation -- https://tanstack.com/router/latest/docs/framework/react/guide/search-params

URL search params are the original global state manager. They enable bookmarking, sharing, back-button navigation, and deep linking.

---

## Why URL State?

- Users can Cmd/Ctrl+Click to open a link in a new tab and see the expected state
- Bookmark and share links with assurance of identical state on load
- Refresh or navigate back/forward without losing state
- Developers get the same DX as other state managers for add/remove/modify

---

## TanStack Router: JSON-First Search Params

TanStack Router automatically converts search params to structured JSON, supporting nested data types that `URLSearchParams` cannot handle natively.

### Navigation with Complex Types

```tsx
<Link
  to="/shop"
  search={{
    pageIndex: 3,
    includeCategories: ['electronics', 'gifts'],
    sortBy: 'price',
    desc: true,
  }}
/>
```

Results in URL: `/shop?pageIndex=3&includeCategories=%5B%22electronics%22%2C%22gifts%22%5D&sortBy=price&desc=true`

First-level values preserve their types (numbers, booleans). Nested data is auto-serialized to URL-safe JSON strings.

---

### Validating and Typing Search Params

Use `validateSearch` to ensure search params are always valid and typed.

```tsx
type ProductSearch = {
  page: number
  filter: string
  sort: 'newest' | 'oldest' | 'price'
}

export const Route = createFileRoute('/shop/products')({
  validateSearch: (search: Record<string, unknown>): ProductSearch => {
    return {
      page: Number(search?.page ?? 1),
      filter: (search.filter as string) || '',
      sort: (search.sort as ProductSearch) || 'newest',
    }
  },
})
```

### Using Zod for Validation + Typing

```tsx
import { z } from 'zod'

const productSearchSchema = z.object({
  page: z.number().catch(1),
  filter: z.string().catch(''),
  sort: z.enum(['newest', 'oldest', 'price']).catch('newest'),
})

type ProductSearch = z.infer<typeof productSearchSchema>

export const Route = createFileRoute('/shop/products')({
  validateSearch: productSearchSchema,
})
```

**Use `.catch()` over `.default()`** to silently handle malformed params without breaking the user experience.

### Zod v4 Adapter (Simplified)

```tsx
import { zodValidator } from '@tanstack/zod-adapter'

export const Route = createFileRoute('/shop/products/')({
  validateSearch: zodValidator(productSearchSchema),
})
```

### Other Validation Libraries

**Valibot** (Standard Schema -- no adapter needed):
```tsx
import * as v from 'valibot'
const schema = v.object({
  page: v.optional(v.fallback(v.number(), 1), 1),
  filter: v.optional(v.fallback(v.string(), ''), ''),
  sort: v.optional(v.fallback(v.picklist(['newest', 'oldest', 'price']), 'newest'), 'newest'),
})
```

**ArkType** (Standard Schema -- no adapter needed):
```tsx
import { type } from 'arktype'
const schema = type({
  page: 'number = 1',
  filter: 'string = ""',
  sort: '"newest" | "oldest" | "price" = "newest"',
})
```

---

### Reading Search Params

```tsx
// In a component
function ProductList() {
  const { page, filter, sort } = Route.useSearch()
  // ...
}

// In a loader
export const Route = createFileRoute('/shop/products')({
  validateSearch: productSearchSchema,
  loader: ({ search }) => {
    // search is already validated and typed
    return fetchProducts(search.page, search.filter, search.sort)
  },
})
```

### Updating Search Params

```tsx
// With Link (declarative)
<Link to="/shop/products" search={{ page: 2, filter: '', sort: 'price' }}>

// With useNavigate (imperative)
const navigate = useNavigate()
navigate({
  to: '/shop/products',
  search: (prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }),
})

// Replace history entry (no new back-button entry)
navigate({
  search: (prev) => ({ ...prev, page: 2 }),
  replace: true,
})
```

---

## Pattern: Filter/Search State in URL

```tsx
type UserFilters = {
  search: string
  role: 'admin' | 'user' | 'all'
  page: number
  perPage: number
}

const userFiltersSchema = z.object({
  search: z.string().catch(''),
  role: z.enum(['admin', 'user', 'all']).catch('all'),
  page: z.number().catch(1),
  perPage: z.number().catch(20),
})

export const Route = createFileRoute('/users')({
  validateSearch: userFiltersSchema,
})

function UserList() {
  const { search, role, page, perPage } = Route.useSearch()
  const navigate = useNavigate()

  // Update filters (replaces history)
  const setFilter = (updates: Partial<UserFilters>) => {
    navigate({
      search: (prev) => ({ ...prev, ...updates, page: updates.search !== undefined ? 1 : prev.page }),
      replace: true,
    })
  }

  const { data: users } = useQuery({
    queryKey: ['users', search, role, page, perPage],
    queryFn: () => fetchUsers({ search, role, page, perPage }),
  })

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setFilter({ search: e.target.value })}
        placeholder="Search users..."
      />
      <select value={role} onChange={(e) => setFilter({ role: e.target.value as UserFilters['role'] })}>
        <option value="all">All Roles</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
      </select>
      {/* Render users, pagination, etc. */}
    </div>
  )
}
```

---

## Pattern: Multi-Step Form State in URL

```tsx
const wizardSchema = z.object({
  step: z.number().min(1).max(3).catch(1),
  name: z.string().catch(''),
  email: z.string().catch(''),
  confirm: z.boolean().catch(false),
})

export const Route = createFileRoute('/signup')({
  validateSearch: wizardSchema,
})

function SignupWizard() {
  const { step } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <>
      {step === 1 && <Step1 onNext={(data) => navigate({ search: { step: 2, ...data } })} />}
      {step === 2 && <Step2 onNext={(data) => navigate({ search: { step: 3, ...data } })} />}
      {step === 3 && <Step3 />}
    </>
  )
}
```

---

## When to Use URL State

| Use URL state for | Keep in component/server state |
|---|---|
| Filters, search queries | Form input values (before submit) |
| Pagination | Modal open/close (ephemeral) |
| Sort order | Loading states |
| Selected item/tab | Error messages |
| Wizard step | Validation errors |
| Comparison state | Optimistic updates |

**Rule of thumb:** If the user should be able to bookmark, share, or deep-link to it, put it in the URL.
