# TanStack Query v5 - Documentation

**Package:** `@tanstack/react-query` v5.102.0
**Docs:** https://tanstack.com/query/latest/docs/framework/react

## Overview

TanStack Query (React Query) is a powerful data synchronization library for React. It manages server state with caching, background updates, and optimistic updates.

## Setup

```typescript
// app.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools />
    </QueryClientProvider>
  )
}
```

## Queries

### Basic Query

```typescript
import { useQuery } from '@tanstack/react-query'

function Todos() {
  const { isPending, isError, data, error } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodoList,
  })

  if (isPending) return <span>Loading...</span>
  if (isError) return <span>Error: {error.message}</span>

  return (
    <ul>
      {data.map((todo) => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  )
}
```

### Query States

A query can only be in one state at a time:

- `isPending` / `status === 'pending'` - No data yet
- `isError` / `status === 'error'` - Error occurred
- `isSuccess` / `status === 'success'` - Data available

Additional states:
- `data` - Available when `isSuccess`
- `error` - Available when `isError`
- `isFetching` - True when any fetch is in progress (including background)

### Query Keys

Query keys are arrays that uniquely identify queries:

```typescript
// Simple key
useQuery({ queryKey: ['todos'], queryFn: fetchTodos })

// With parameters
useQuery({ queryKey: ['todo', todoId], queryFn: () => fetchTodo(todoId) })

// With multiple parameters
useQuery({
  queryKey: ['todos', { status, page }],
  queryFn: () => fetchTodos(status, page),
})

// Nested objects work too
useQuery({
  queryKey: ['todos', { status: 'done', page: 1, search: 'hello' }],
  queryFn: fetchTodos,
})
```

### Query Functions

```typescript
// Fetch function
const fetchTodos = async (): Promise<Todo[]> => {
  const response = await fetch('/api/todos')
  if (!response.ok) throw new Error('Network error')
  return response.json()
}

// With parameters
const fetchTodo = async (id: number): Promise<Todo> => {
  const response = await fetch(`/api/todos/${id}`)
  if (!response.ok) throw new Error('Not found')
  return response.json()
}
```

### Query Options (Recommended)

```typescript
import { queryOptions } from '@tanstack/react-query'

export function todoOptions(id: number) {
  return queryOptions({
    queryKey: ['todo', id],
    queryFn: () => fetchTodo(id),
    staleTime: 1000 * 60 * 5,
  })
}

// Usage in component
function TodoDetail({ id }: { id: number }) {
  const { data } = useQuery(todoOptions(id))
}
```

## Mutations

### Basic Mutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

function AddTodo() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (newTodo) => {
      return axios.post('/todos', newTodo)
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  return (
    <div>
      {mutation.isPending ? (
        'Adding todo...'
      ) : mutation.isError ? (
        <div>Error: {mutation.error.message}</div>
      ) : mutation.isSuccess ? (
        <div>Todo added!</div>
      ) : null}
      <button
        onClick={() => {
          mutation.mutate({ id: new Date(), title: 'Do Laundry' })
        }}
      >
        Create Todo
      </button>
    </div>
  )
}
```

### Mutation States

- `isIdle` / `status === 'idle'` - Fresh/reset state
- `isPending` / `status === 'pending'` - Currently running
- `isError` / `status === 'error'` - Error occurred
- `isSuccess` / `status === 'success'` - Successful

### Mutation Callbacks

```typescript
useMutation({
  mutationFn: addTodo,
  onMutate: async (variables) => {
    // Cancel current queries
    await queryClient.cancelQueries({ queryKey: ['todos'] })

    // Optimistic update
    const previousTodos = queryClient.getQueryData(['todos'])
    queryClient.setQueryData(['todos'], (old) => [...old, variables])

    // Return context for rollback
    return { previousTodos }
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['todos'], context.previousTodos)
  },
  onSettled: () => {
    // Always refetch after error or success
    queryClient.invalidateQueries({ queryKey: ['todos'] })
  },
})
```

### Async Mutations

```typescript
const mutation = useMutation({
  mutationFn: addTodo,
})

// Using mutateAsync for try/catch
try {
  const todo = await mutation.mutateAsync({ title: 'New Todo' })
  console.log(todo)
} catch (error) {
  console.error(error)
} finally {
  console.log('done')
}
```

### Resetting Mutation State

```typescript
const mutation = useMutation({
  mutationFn: createTodo,
})

// Reset error/data state
mutation.reset()
```

## Optimistic Updates

```typescript
useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todo', newTodo.id] })

    const previousTodo = queryClient.getQueryData(['todo', newTodo.id])

    queryClient.setQueryData(['todo', newTodo.id], newTodo)

    return { previousTodo }
  },
  onError: (err, newTodo, context) => {
    queryClient.setQueryData(['todo', newTodo.id], context.previousTodo)
  },
  onSettled: (data, error, variables) => {
    queryClient.invalidateQueries({ queryKey: ['todo', variables.id] })
  },
})
```

## Query Invalidation

```typescript
// Invalidate specific query
await queryClient.invalidateQueries({ queryKey: ['todos'] })

// Invalidate all queries
await queryClient.invalidateQueries()

// Invalidate with predicates
await queryClient.invalidateQueries({
  predicate: (query) =>
    query.queryKey[0] === 'todos' && query.queryKey[1]?.status === 'done',
})
```

## Query Client Methods

```typescript
// Get cached data
const data = queryClient.getQueryData(['todos'])

// Set cached data directly
queryClient.setQueryData(['todos'], newTodos)

// Remove query from cache
queryClient.removeQueries({ queryKey: ['todos'] })

// Cancel ongoing queries
await queryClient.cancelQueries({ queryKey: ['todos'] })

// Prefetch data
await queryClient.prefetchQuery({
  queryKey: ['todos'],
  queryFn: fetchTodos,
})
```

## Dependent Queries

```typescript
function UserProfile({ userId }: { userId: number }) {
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  })

  const { data: projects, isPending } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: () => fetchProjects(user!.id),
    enabled: !!user?.id, // Only run when user is available
  })
}
```

## Infinite Queries

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'

function Projects() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['projects'],
    queryFn: ({ pageParam }) => fetchProjects(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
  })

  return (
    <div>
      {data?.pages.map((page, i) => (
        <React.Fragment key={i}>
          {page.projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </React.Fragment>
      ))}
      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading more...' : 'Load More'}
      </button>
    </div>
  )
}
```

## Query Cancellation

```typescript
const queryClient = useQueryClient()

const abortController = new AbortController()

const { data } = useQuery({
  queryKey: ['todos'],
  queryFn: ({ signal }) => fetch('/api/todos', { signal }),
})

// Cancel manually
queryClient.cancelQueries({ queryKey: ['todos'] })
```

## Key Patterns

1. Always use `queryKey` arrays for cache invalidation
2. Use `queryOptions` factory for reusable query configurations
3. Prefer `mutateAsync` with try/catch over `onError` for component-level error handling
4. Use `invalidateQueries` after mutations to refetch
5. Use `enabled` option for dependent queries
6. Keep `staleTime` reasonable (default 0 means immediate refetch on window focus)
7. Use `select` to transform data in the query:
   ```typescript
   useQuery({
     queryKey: ['todos'],
     queryFn: fetchTodos,
     select: (data) => data.filter((t) => !t.completed),
   })
   ```
