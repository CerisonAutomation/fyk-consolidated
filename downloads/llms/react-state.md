# React State Management Best Practices

> Source: Official React documentation -- https://react.dev/learn/managing-state

## Core Principles

### 1. React to Input with State (Not Imperative Commands)

Don't write `disable the button`, `show the success message`. Instead, describe the UI for each visual state and trigger state changes in response to input.

```tsx
import { useState } from 'react'

export default function Form() {
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('typing')

  if (status === 'success') {
    return <h1>That's right!</h1>
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('submitting')
    try {
      await submitForm(answer)
      setStatus('success')
    } catch (err) {
      setStatus('typing')
      setError(err)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={status === 'submitting'}
      />
      <button disabled={answer.length === 0 || status === 'submitting'}>
        Submit
      </button>
      {error && <p className="Error">{error.message}</p>}
    </form>
  )
}
```

---

### 2. Choose the State Structure (Avoid Redundancy)

**Never store derived data as state.** If a value can be computed from existing state during render, compute it -- don't store it.

```tsx
// BAD: Redundant state
const [firstName, setFirstName] = useState('')
const [lastName, setLastName] = useState('')
const [fullName, setFullName] = useState('') // <- redundant

// GOOD: Derived value
const [firstName, setFirstName] = useState('')
const [lastName, setLastName] = useState('')
const fullName = firstName + ' ' + lastName // <- computed during render
```

**State structure rules:**
- No redundant or duplicated information
- State should contain the minimum amount of information needed
- Avoid deeply nested objects -- flatten when possible
- If you find yourself writing `setX(prev => ({ ...prev, ... }))` often, restructure

---

### 3. Lifting State Up (Share Between Components)

When two components need to sync, remove state from both, move it to the closest common parent, and pass it down via props.

```tsx
import { useState } from 'react'

export default function Accordion() {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <>
      <Panel
        title="About"
        isActive={activeIndex === 0}
        onShow={() => setActiveIndex(0)}
      >
        Content about...
      </Panel>
      <Panel
        title="Etymology"
        isActive={activeIndex === 1}
        onShow={() => setActiveIndex(1)}
      >
        Content about...
      </Panel>
    </>
  )
}

function Panel({ title, children, isActive, onShow }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {isActive ? <p>{children}</p> : <button onClick={onShow}>Show</button>}
    </section>
  )
}
```

---

### 4. Preserve and Reset State (Keys)

Use the `key` prop to force React to reset component state when identity changes.

```tsx
// Switching contacts doesn't reset the chat input (BAD)
<Chat contact={to} />

// Switching contacts DOES reset (GOOD)
<Chat key={to.email} contact={to} />
```

---

### 5. Extract Complex Logic with `useReducer`

When state updates are complex and spread across many handlers, consolidate into a reducer.

```tsx
import { useReducer } from 'react'

function tasksReducer(tasks, action) {
  switch (action.type) {
    case 'added':
      return [...tasks, { id: action.id, text: action.text, done: false }]
    case 'changed':
      return tasks.map((t) =>
        t.id === action.task.id ? action.task : t
      )
    case 'deleted':
      return tasks.filter((t) => t.id !== action.id)
    default:
      throw Error('Unknown action: ' + action.type)
  }
}

export default function TaskApp() {
  const [tasks, dispatch] = useReducer(tasksReducer, initialTasks)

  function handleAddTask(text) {
    dispatch({ type: 'added', id: nextId++, text })
  }

  function handleChangeTask(task) {
    dispatch({ type: 'changed', task })
  }

  function handleDeleteTask(taskId) {
    dispatch({ type: 'deleted', id: taskId })
  }

  return (
    <>
      <h1>Prague itinerary</h1>
      <AddTask onAddTask={handleAddTask} />
      <TaskList
        tasks={tasks}
        onChangeTask={handleChangeTask}
        onDeleteTask={handleDeleteTask}
      />
    </>
  )
}
```

**When to use `useReducer` vs `useState`:**
- `useState` -- Simple state (primitives, small objects)
- `useReducer` -- Complex state transitions, multiple related values, logic in multiple event handlers

---

### 6. Scale with Reducer + Context

Combine `useReducer` with `useContext` for app-level state without external libraries.

```tsx
// TasksContext.js
import { createContext, useContext, useReducer } from 'react'

const TasksContext = createContext(null)
const TasksDispatchContext = createContext(null)

export function TasksProvider({ children }) {
  const [tasks, dispatch] = useReducer(tasksReducer, initialTasks)
  return (
    <TasksContext.Provider value={tasks}>
      <TasksDispatchContext.Provider value={dispatch}>
        {children}
      </TasksDispatchContext.Provider>
    </TasksContext.Provider>
  )
}

export function useTasks() {
  return useContext(TasksContext)
}

export function useTasksDispatch() {
  return useContext(TasksDispatchContext)
}
```

```tsx
// App.js -- wrap with provider
import { TasksProvider } from './TasksContext'

export default function TaskApp() {
  return (
    <TasksProvider>
      <h1>Day off in Kyoto</h1>
      <AddTask />
      <TaskList />
    </TasksProvider>
  )
}
```

---

## State Management Decision Tree

```
Is the state local to one component?
  YES -> useState
  NO  -> Is it UI state (modals, form inputs)?
          YES -> Lift state up (closest common parent)
          NO  -> Is it server state (fetched from API)?
                  YES -> TanStack Query (React Query)
                  NO  -> Is it URL state (filters, pagination)?
                          YES -> URL search params (React Router / TanStack Router)
                          NO  -> Is it form state?
                                  YES -> TanStack Form / React Hook Form
                                  NO  -> Is it shared across many distant components?
                                          YES -> useReducer + useContext (or Zustand for complex apps)
                                          NO  -> Lifting state up
```

---

## Common Anti-Patterns

1. **Storing computed values as state** -- Compute during render instead
2. **Boolean state for "which mode"** -- Use `status` string enums instead (`'typing' | 'submitting' | 'success'`)
3. **Deeply nested state objects** -- Flatten into separate state variables
4. **Putting state too high or too low** -- Find the closest common parent
5. **Using Context for frequently-changing values** -- Context re-renders all consumers; use Zustand or selectors for performance-critical state
