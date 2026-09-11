# TanStack Query Optimistic Updates Patterns

> Source: Official TanStack Query documentation -- https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

TanStack Query provides two ways to optimistically update your UI before a mutation has completed.

---

## Approach 1: Via the UI (Simpler)

Use `variables` from `useMutation` to render temporary UI without touching the cache.

```tsx
const addTodoMutation = useMutation({
  mutationFn: (newTodo: string) => axios.post('/api/todos', { text: newTodo }),
  // Return the Promise from queryClient.invalidateQueries
  // so the mutation stays in `pending` state until refetch finishes
  onSettled: () =>
    queryClient.invalidateQueries({ queryKey: ['todos'] }),
})

const { isPending, variables, mutate, isError } = addTodoMutation

// Render a temporary item while mutation is pending
<ul>
  {todoQuery.data.items.map((todo) => (
    <li key={todo.id}>{todo.text}</li>
  ))}
  {isPending && <li style={{ opacity: 0.5 }}>{variables}</li>}
</ul>

// Show error state with retry
{isError && (
  <li style={{ color: 'red' }}>
    {variables}
    <button onClick={() => mutate(variables)}>Retry</button>
  </li>
)}
```

**When to use:** Single place showing the optimistic result. No rollback handling needed.

### Cross-Component Optimistic UI with `useMutationState`

When the mutation and query live in different components:

```tsx
// Component A -- triggers the mutation
const { mutate } = useMutation({
  mutationFn: (newTodo: string) => axios.post('/api/todos', { text: newTodo }),
  onSettled: () =>
    queryClient.invalidateQueries({ queryKey: ['todos'] }),
  mutationKey: ['addTodo'],
})

// Component B -- reads pending variables from anywhere
const pendingVariables = useMutationState<string>({
  filters: { mutationKey: ['addTodo'], status: 'pending' },
  select: (mutation) => mutation.state.variables,
})
```

---

## Approach 2: Via the Cache (Advanced)

Manually update the query cache on mutation, with rollback on error.

### Adding to a List

```tsx
const queryClient = useQueryClient()

useMutation({
  mutationFn: addTodo,
  onMutate: async (newTodo, context) => {
    // 1. Cancel outgoing refetches (don't overwrite our optimistic update)
    await context.client.cancelQueries({ queryKey: ['todos'] })

    // 2. Snapshot the previous value
    const previousTodos = context.client.getQueryData(['todos'])

    // 3. Optimistically update to the new value
    context.client.setQueryData(['todos'], (old) => [...old, newTodo])

    // 4. Return context with snapshotted value
    return { previousTodos }
  },

  // If mutation fails, roll back
  onError: (err, newTodo, onMutateResult, context) => {
    context.client.setQueryData(['todos'], onMutateResult.previousTodos)
  },

  // Always refetch after error or success
  onSettled: (data, error, variables, onMutateResult, context) =>
    context.client.invalidateQueries({ queryKey: ['todos'] }),
})
```

### Updating a Single Item

```tsx
useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo, context) => {
    await context.client.cancelQueries({
      queryKey: ['todos', newTodo.id],
    })

    const previousTodo = context.client.getQueryData(['todos', newTodo.id])
    context.client.setQueryData(['todos', newTodo.id], newTodo)

    return { previousTodo, newTodo }
  },

  onError: (err, newTodo, onMutateResult, context) => {
    context.client.setQueryData(
      ['todos', onMutateResult.newTodo.id],
      onMutateResult.previousTodo
    )
  },

  onSettled: (newTodo, error, variables, onMutateResult, context) =>
    context.client.invalidateQueries({ queryKey: ['todos', newTodo.id] }),
})
```

---

## The 4-Step Pattern

Every cache-based optimistic update follows this sequence:

1. **Cancel** -- `context.client.cancelQueries(...)` prevents stale refetches from overwriting the optimistic state
2. **Snapshot** -- `context.client.getQueryData(...)` captures the current state for rollback
3. **Update** -- `context.client.setQueryData(...)` applies the optimistic change
4. **Return** -- The returned object becomes the context for `onError` and `onSettled`

---

## Decision Matrix

| Factor | Via UI (variables) | Via Cache (onMutate) |
|--------|-------------------|---------------------|
| Code complexity | Low | Medium |
| Rollback handling | Automatic (disappears) | Manual (snapshot restore) |
| Multiple display points | Requires `useMutationState` | Automatic (cache subscribers) |
| Concurrent mutations | `submittedAt` for ordering | Manual ordering |
| Best for | Simple add-to-list | Complex updates, cross-component |

---

## Common Gotchas

**Always cancel queries first** -- Without cancellation, a background refetch can overwrite your optimistic update while the mutation is still pending.

**Always snapshot** -- Without a snapshot, `onError` cannot restore the previous state.

**Use `onSettled` over separate `onSuccess`/`onError`** -- It runs in both cases, ensuring cache invalidation happens regardless of outcome.

**For concurrent optimistic updates**, use `mutation.state.submittedAt` as a unique key:
```tsx
const pendingMutations = useMutationState({
  select: (mutation) => ({
    ...mutation.state,
    key: `${mutation.state.submittedAt}`,
  }),
})
```
