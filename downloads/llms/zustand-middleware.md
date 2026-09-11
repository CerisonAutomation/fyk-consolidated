# Zustand Middleware Patterns

> Sources: Official Zustand documentation (pmndrs/zustand), community patterns

Zustand middleware wraps stores to add cross-cutting concerns. Middleware compose via currying and execute in order.

---

## Built-in Middleware

### `persist` -- LocalStorage/SessionStorage Persistence

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface BearState {
  bears: number
  increase: (by: number) => void
}

const useBearStore = create<BearState>()(
  persist(
    (set) => ({
      bears: 0,
      increase: (by) => set((s) => ({ bears: s.bears + by })),
    }),
    {
      name: 'bear-storage', // key in storage
      storage: createJSONStorage(() => sessionStorage),
      // Partialize: only persist certain fields
      partialize: (state) => ({ bears: state.bears }),
      // Version for migration
      version: 1,
      migrate: (persistedState, version) => {
        if (version === 0) {
          // migrate from v0 to v1
          return { bears: (persistedState as any).bearCount ?? 0 }
        }
        return persistedState as BearState
      },
    }
  )
)
```

**Key options:**
- `name` -- Storage key (required)
- `storage` -- Defaults to `localStorage`
- `partialize` -- Pick which fields to persist
- `merge` -- Custom merge strategy on hydration
- `version` / `migrate` -- Schema migration support
- `skipHydration` -- Skip auto-hydration (manual via `useBearStore.persist.rehydrate()`)

### `devtools` -- Redux DevTools Integration

```ts
import { devtools } from 'zustand/middleware'

const useStore = create<State>()(
  devtools(
    (set) => ({
      count: 0,
      inc: () => set((s) => ({ count: s.count + 1 }), false, 'inc'),
    }),
    { name: 'CounterStore' }
  )
)
```

**Third argument to `set`** is the action name shown in DevTools.

### `immer` -- Immutable Updates via Proxies

```ts
import { immer } from 'zustand/middleware/immer'

const useStore = create<State>()(
  immer((set) => ({
    todos: [] as string[],
    addTodo: (text) =>
      set((state) => {
        state.todos.push(text) // direct mutation via Immer
      }),
    updateTodo: (index, text) =>
      set((state) => {
        state.todos[index] = text
      }),
  }))
)
```

### `subscribeWithSelector` -- Fine-Grained Subscriptions

```ts
import { subscribeWithSelector } from 'zustand/middleware'

const useStore = create<State>()(
  subscribeWithSelector((set) => ({
    name: 'John',
    age: 25,
    setName: (name) => set({ name }),
    setAge: (age) => set({ age }),
  }))
)

// Subscribe to a specific slice
const unsub = useStore.subscribe(
  (s) => s.age,
  (age, prevAge) => {
    console.log(`Age changed from ${prevAge} to ${age}`)
  }
)
```

### `combine` -- Merge Multiple Slices

```ts
import { combine } from 'zustand/middleware'

const useStore = create(
  combine(
    { bears: 0, fish: 0 },
    (set, get) => ({
      increaseBears: (by: number) => set((s) => ({ bears: s.bears + by })),
      increaseFish: (by: number) => set((s) => ({ fish: s.fish + by })),
      getTotal: () => get().bears + get().fish,
    })
  )
)
```

### `redux` -- Redux-like Reducer Pattern

```ts
import { redux } from 'zustand/middleware'

type State = { count: number }
type Action = { type: 'increment' } | { type: 'decrement' }

const useStore = create<State>()(
  redux(
    (state: State, action: Action) => {
      switch (action.type) {
        case 'increment': return { count: state.count + 1 }
        case 'decrement': return { count: state.count - 1 }
        default: return state
      }
    },
    { count: 0 }
  )
)

useStore.dispatch({ type: 'increment' })
```

---

## Composing Middleware

Middleware compose by nesting. **Order matters**: outermost runs first.

```ts
const useStore = create<State>()(
  devtools(
    persist(
      immer((set) => ({
        todos: [] as Todo[],
        add: (text: string) =>
          set((state) => {
            state.todos.push({ id: crypto.randomUUID(), text, done: false })
          }),
        toggle: (id: string) =>
          set((state) => {
            const todo = state.todos.find((t) => t.id === id)
            if (todo) todo.done = !todo.done
          }),
        remove: (id: string) =>
          set((state) => {
            state.todos = state.todos.filter((t) => t.id !== id)
          }),
      })),
      { name: 'todo-storage', partialize: (s) => s.todos }
    ),
    { name: 'TodoStore' }
  )
)
```

**Recommended composition order:** `devtools` > `persist` > `immer`

---

## Custom Middleware

Custom middleware is a function that returns a state creator wrapping the original.

```ts
import { StateCreator, StoreApi, createStore } from 'zustand'

// Logger middleware
function logger<T>(
  f: StateCreator<T, [], [], T>,
  name?: string
): StateCreator<T, [], [], T> {
  return (set, get, store) => {
    const loggedSet: typeof set = (...args) => {
      console.log(`[${name || 'store'}] setting`, ...args)
      set(...args)
      console.log(`[${name || 'store'}] new state`, get())
    }
    return f(loggedSet, get, store)
  }
}

// Async initializer middleware
function asyncInit<T>(
  f: StateCreator<T, [], [], T>,
  initializer: () => Promise<Partial<T>>
): StateCreator<T, [], [], T> {
  return (set, get, store) => {
    initializer().then((init) => set(init))
    return f(set, get, store)
  }
}

// Usage
const useStore = create<State>()(
  logger(
    asyncInit(
      (set) => ({
        user: null,
        setUser: (user) => set({ user }),
      }),
      async () => {
        const user = await fetchUser()
        return { user }
      }
    ),
    'UserStore'
  )
)
```

---

## TypeScript Patterns with Middleware

```ts
// Typed store slice
interface BearSlice {
  bears: number
  addBear: (by: number) => void
}

const createBearSlice: StateCreator<
  BearSlice & FishSlice,
  [],
  [],
  BearSlice
> = (set) => ({
  bears: 0,
  addBear: (by) => set((s) => ({ bears: s.bears + by })),
})

// Composed typed store
interface FishSlice {
  fish: number
  addFish: (by: number) => void
}

const createFishSlice: StateCreator<
  BearSlice & FishSlice,
  [],
  [],
  FishSlice
> = (set) => ({
  fish: 0,
  addFish: (by) => set((s) => ({ fish: s.fish + by })),
})

const useBoundStore = create<BearSlice & FishSlice>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
}))
```

---

## Common Patterns

### Temporal / Undo-Redo

```ts
import { temporal } from 'zundo'

const useStore = create<State>()(
  temporal(
    (set) => ({
      text: '',
      setText: (text) => set({ text }),
    }),
    {
      limit: 50, // history limit
      equality: (pastState, currentState) =>
        pastState.text === currentState.text,
    }
  )
)

// Usage
const { undo, redo, pastStates, futureStates } =
  useStore.temporal.getState()
```

### Cross-Tab Synchronization

```ts
import { subscribeWithSelector } from 'zustand/middleware'
import { createJSONStorage } from 'zustand/middleware'

// Broadcast state changes across tabs
const useStore = create<State>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        theme: 'light',
        setTheme: (theme) => set({ theme }),
      }),
      {
        name: 'app-settings',
        storage: createJSONStorage(() => localStorage),
      }
    )
  )
)

// In another tab, listen for storage events
window.addEventListener('storage', (e) => {
  if (e.key === 'app-settings' && e.newValue) {
    const parsed = JSON.parse(e.newValue)
    useStore.setState(parsed.state)
  }
})
```
