# Zustand v5 - Documentation

**Package:** `zustand` v5.0.0
**Docs:** https://zustand.docs.pmnd.rs

## Overview

Zustand is a small, fast, and scalable state management solution for React. It has a minimal API, works with React 18+ concurrent features, and can be shared across React, React Native, and non-React environments.

## Installation

```bash
npm install zustand
# or
yarn add zustand
# or
pnpm add zustand
```

## Basic Store

```typescript
import { create } from 'zustand'

interface BearState {
  bears: number
  increase: (by?: number) => void
  decrease: (by?: number) => void
  reset: () => void
}

const useBearStore = create<BearState>((set) => ({
  bears: 0,
  increase: (by = 1) => set((state) => ({ bears: state.bears + by })),
  decrease: (by = 1) => set((state) => ({ bears: state.bears - by })),
  reset: () => set({ bears: 0 }),
}))
```

## Using in Components

```typescript
function BearCounter() {
  const bears = useBearStore((state) => state.bears)
  return <h1>{bears} bears around here...</h1>
}

function Controls() {
  const increase = useBearStore((state) => state.increase)
  const decrease = useBearStore((state) => state.decrease)

  return (
    <div>
      <button onClick={() => increase()}>Increase</button>
      <button onClick={() => decrease()}>Decrease</button>
    </div>
  )
}
```

## Selectors (Performance Optimization)

```typescript
// Bad: re-renders on any state change
const { bears, increase } = useBearStore()

// Good: only re-renders when bears changes
const bears = useBearStore((state) => state.bears)
const increase = useBearStore((state) => state.increase)

// Shallow equality for objects
import { shallow } from 'zustand/shallow'

const { bears, increase } = useBearStore(
  (state) => ({
    bears: state.bears,
    increase: state.increase,
  }),
  shallow
)
```

## Set with Immer

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface TodoState {
  todos: Todo[]
  addTodo: (todo: Todo) => void
  toggleTodo: (id: string) => void
}

const useTodoStore = create<TodoState>()(
  immer((set) => ({
    todos: [],
    addTodo: (todo) =>
      set((state) => {
        state.todos.push(todo)
      }),
    toggleTodo: (id) =>
      set((state) => {
        const todo = state.todos.find((t) => t.id === id)
        if (todo) todo.completed = !todo.completed
      }),
  }))
)
```

## Middleware

### Logger Middleware

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

const useStore = create(
  devtools(
    persist(
      (set) => ({
        count: 0,
        increase: () => set((state) => ({ count: state.count + 1 })),
      }),
      { name: 'my-store' }
    )
  )
)
```

### Persist Middleware

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increase: () => set((state) => ({ count: state.count + 1 })),
    }),
    {
      name: 'my-storage', // key in localStorage
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          return str ? JSON.parse(str) : null
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      partialize: (state) => ({ count: state.count }), // only persist count
    }
  )
)
```

### Devtools Middleware

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const useStore = create(
  devtools(
    (set) => ({
      count: 0,
      increase: () => set((state) => ({ count: state.count + 1 })),
    }),
    { name: 'My Store' } // name in Redux DevTools
  )
)
```

## Slices Pattern (Modular Stores)

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface BearSlice {
  bears: number
  addBear: () => void
}

interface FishSlice {
  fish: number
  addFish: () => void
}

const createBearSlice = (set): BearSlice => ({
  bears: 0,
  addBear: () => set((state) => ({ bears: state.bears + 1 }), false, 'addBear'),
})

const createFishSlice = (set): FishSlice => ({
  fish: 0,
  addFish: () => set((state) => ({ fish: state.fish + 1 }), false, 'addFish'),
})

const useBoundStore = create<BearSlice & FishSlice>()(
  devtools(
    (...a) => ({
      ...createBearSlice(...a),
      ...createFishSlice(...a),
    }),
    { name: 'CompleteStore' }
  )
)
```

## Async Actions

```typescript
const useStore = create((set, get) => ({
  data: null,
  loading: false,
  error: null,
  fetchData: async () => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/data')
      const data = await response.json()
      set({ data, loading: false })
    } catch (error) {
      set({ error: error.message, loading: false })
    }
  },
}))
```

## Outside React Components

```typescript
import { useStore } from 'zustand'

// Access store outside React
const count = useStore.getState().count
useStore.getState().increase()

// Subscribe to changes
const unsubscribe = useStore.subscribe((state) => {
  console.log('State changed:', state)
})

// Update state
useStore.setState({ count: 5 })
```

## Resetting Store

```typescript
const useStore = create(
  persist(
    (set, get) => ({
      count: 0,
      increase: () => set((state) => ({ count: state.count + 1 })),
      reset: () => set({ count: 0 }),
    }),
    { name: 'my-store' }
  )
)

// Reset store
useStore.getState().reset()
```

## Key Patterns

1. Use selectors to avoid unnecessary re-renders
2. Use `shallow` equality for object comparisons
3. Use `immer` middleware for complex state updates
4. Use `devtools` middleware in development
5. Use `persist` middleware for localStorage persistence
6. Use slices pattern for large stores
7. Access store outside React via `useStore.getState()` and `useStore.setState()`
8. In v5, `createContext` was removed - use regular store creation
