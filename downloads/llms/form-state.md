# Form State Management Patterns

> Source: TanStack Form documentation -- https://tanstack.com/form/latest/docs/react/overview

---

## Why TanStack Form?

Most web frameworks leave form handling to custom implementations or less-capable libraries. TanStack Form provides:
- Reactive data binding and state management
- Complex validation and error handling
- Accessibility and responsive design
- Cross-platform compatibility and custom styling
- First-class TypeScript support with headless UI

---

## Basic Form Setup

```tsx
import { useForm } from '@tanstack/react-form'

export default function App() {
  const form = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
    },
    onSubmit: async ({ value }) => {
      console.log(value) // { firstName: string, lastName: string }
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <form.Field
        name="firstName"
        children={(field) => (
          <>
            <label htmlFor={field.name}>First Name:</label>
            <input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </>
        )}
      />

      <form.Field
        name="lastName"
        children={(field) => (
          <>
            <label htmlFor={field.name}>Last Name:</label>
            <input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </>
        )}
      />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit}>
            {isSubmitting ? '...' : 'Submit'}
          </button>
        )}
      />
    </form>
  )
}
```

---

## Field Validation

### Sync Validation

```tsx
<form.Field
  name="email"
  validators={{
    onChange: ({ value }) =>
      !value
        ? 'Email is required'
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          ? 'Invalid email address'
          : undefined,
  }}
  children={(field) => (
    <>
      <input
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
      {field.state.meta.isTouched && !field.state.meta.isValid && (
        <em>{field.state.meta.errors.join(', ')}</em>
      )}
    </>
  )}
/>
```

### Async Validation (Debounced)

```tsx
<form.Field
  name="username"
  validators={{
    onChangeAsyncDebounceMs: 500,
    onChangeAsync: async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // Check against API
      const taken = await checkUsernameAvailable(value)
      return taken ? 'Username is already taken' : undefined
    },
  }}
  children={(field) => (
    <>
      <input
        value={field.state.value}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      {field.state.meta.isValidating && <span>Validating...</span>}
      {field.state.meta.isTouched && !field.state.meta.isValid && (
        <em>{field.state.meta.errors.join(', ')}</em>
      )}
    </>
  )}
/>
```

---

## Form-Level Validation

```tsx
const form = useForm({
  defaultValues: {
    password: '',
    confirmPassword: '',
  },
  validators={{
    onSubmit: ({ value }) => {
      if (value.password !== value.confirmPassword) {
        return 'Passwords do not match'
      }
    },
  },
  onSubmit: async ({ value }) => {
    await createUser(value)
  },
})
```

---

## FieldInfo Component (Reusable Error Display)

```tsx
import type { AnyFieldApi } from '@tanstack/react-form'

export function FieldInfo({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && !field.state.meta.isValid ? (
        <em>{field.state.meta.errors.join(', ')}</em>
      ) : null}
      {field.state.meta.isValidating ? 'Validating...' : null}
    </>
  )
}

// Usage
<form.Field
  name="email"
  validators={{
    onChange: ({ value }) =>
      !value ? 'Required' : !value.includes('@') ? 'Invalid email' : undefined,
  }}
  children={(field) => (
    <>
      <input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
      <FieldInfo field={field} />
    </>
  )}
/>
```

---

## Form State API

### Key State Properties

| Property | Description |
|---|---|
| `field.state.value` | Current field value |
| `field.state.isTouched` | Whether field has been focused and blurred |
| `field.state.isDirty` | Whether value differs from `defaultValue` |
| `field.state.meta.isValid` | Whether field passes all validation |
| `field.state.meta.errors` | Array of current error messages |
| `field.state.meta.isValidating` | Whether async validation is running |

### Form-Level State

| Property | Description |
|---|---|
| `form.state.canSubmit` | Whether all validations pass |
| `form.state.isSubmitting` | Whether `onSubmit` is in progress |
| `form.state.isDirty` | Whether any field is dirty |
| `form.state.isValid` | Whether all fields are valid |

---

## Form with Arrays (Dynamic Fields)

```tsx
const form = useForm({
  defaultValues: {
    items: [{ name: '', quantity: 1 }] as Array<{ name: string; quantity: number }>,
  },
  onSubmit: async ({ value }) => {
    console.log(value.items)
  },
})

// Add item
function addItem() {
  form.setFieldValue('items', (prev) => [
    ...prev,
    { name: '', quantity: 1 },
  ])
}

// Render items
{form.state.values.items.map((_, index) => (
  <div key={index}>
    <form.Field
      name={`items[${index}].name`}
      children={(field) => (
        <input
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
        />
      )}
    />
    <form.Field
      name={`items[${index}].quantity`}
      children={(field) => (
        <input
          type="number"
          value={field.state.value}
          onChange={(e) => field.handleChange(Number(e.target.value))}
        />
      )}
    />
    <button onClick={() => removeItem(index)}>Remove</button>
  </div>
))}
```

---

## Form with Server Submission (TanStack Query Integration)

```tsx
import { useMutation, useQueryClient } from '@tanstack/tanstack-query'

function CreateTodoForm() {
  const queryClient = useQueryClient()

  const createTodo = useMutation({
    mutationFn: (data: { title: string; description: string }) =>
      fetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  const form = useForm({
    defaultValues: { title: '', description: '' },
    onSubmit: async ({ value }) => {
      await createTodo.mutateAsync(value)
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <form.Field
        name="title"
        validators={{ onChange: ({ value }) => !value ? 'Required' : undefined }}
        children={(field) => (
          <input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
        )}
      />
      <form.Field
        name="description"
        children={(field) => (
          <textarea value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
        )}
      />
      <form.Subscribe
        selector={(s) => [s.canSubmit, s.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Todo'}
          </button>
        )}
      />
    </form>
  )
}
```

---

## Common Patterns

### Reset on Submit

```tsx
onSubmit: async ({ value, formApi }) => {
  await saveData(value)
  formApi.reset() // Reset all fields to defaultValues
}
```

### Dependent Fields

```tsx
<form.Field
  name="country"
  children={(countryField) => (
    <>
      <select
        value={countryField.state.value}
        onChange={(e) => {
          countryField.handleChange(e.target.value)
          // Reset city when country changes
          form.setFieldValue('city', '')
        }}
      >
        <option value="us">United States</option>
        <option value="uk">United Kingdom</option>
      </select>

      <form.Field
        name="city"
        children={(cityField) => (
          <select
            value={cityField.state.value}
            onChange={(e) => cityField.handleChange(e.target.value)}
          >
            {getCitiesForCountry(countryField.state.value).map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        )}
      />
    </>
  )}
/>
```

### Optimistic Form Updates with `formApi.setFieldValue`

```tsx
// Update multiple fields at once
form.setFieldValue('firstName', 'John')
form.setFieldValue('lastName', 'Doe')

// Or batch
form.setFieldValue('user', (prev) => ({ ...prev, name: 'John Doe' }))
```

---

## Comparison: TanStack Form vs Alternatives

| Feature | TanStack Form | React Hook Form | Formik |
|---|---|---|---|
| TypeScript | First-class generic types | Good | Weak |
| Bundle size | ~12KB | ~9KB | ~44KB |
| Performance | Fine-grained subscriptions | Uncontrolled refs | Re-renders on change |
| Validation | Field-level + form-level | Resolver-based | Schema-based |
| Validation lib support | Any (manual) | Zod, Yup, Joi, etc. | Yup |
| Framework | React, Vue, Angular, Solid | React only | React |
| DevTools | Yes (@tanstack/react-form-devtools) | Limited | No |
| Headless | Yes | Yes | Yes |
