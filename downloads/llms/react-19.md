# React 19 Features - Practical Implementation Patterns

> Compiled from official React documentation and community resources (December 2024+)

---

## Table of Contents

1. [Actions & Form Handling](#actions--form-handling)
2. [useActionState Hook](#useactionstate-hook)
3. [useOptimistic Hook](#useoptimistic-hook)
4. [use() API](#use-api)
5. [useFormStatus Hook](#useformstatus-hook)
6. [ref as a Prop](#ref-as-a-prop)
7. [Context as Provider](#context-as-provider)
8. [React Server Components](#react-server-components)
9. [Server Actions](#server-actions)
10. [Document Metadata](#document-metadata)
11. [Asset Loading](#asset-loading)
12. [React Compiler](#react-compiler)
13. [Static APIs](#static-apis)
14. [Hydration Error Improvements](#hydration-error-improvements)

---

## Actions & Form Handling

React 19 introduces "Actions" -- async functions used in transitions to handle pending states, errors, forms, and optimistic updates automatically.

### Before (React 18)

```tsx
function UpdateName() {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async () => {
    setIsPending(true);
    const error = await updateName(name);
    setIsPending(false);
    if (error) {
      setError(error);
      return;
    }
    redirect("/path");
  };

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSubmit} disabled={isPending}>
        Update
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}
```

### After (React 19)

```tsx
function UpdateName() {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const error = await updateName(name);
      if (error) {
        setError(error);
        return;
      }
      redirect("/path");
    });
  };

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSubmit} disabled={isPending}>
        Update
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}
```

### With `<form>` Actions

```tsx
function ChangeName({ name, setName }) {
  const [error, submitAction, isPending] = useActionState(
    async (previousState, formData) => {
      const error = await updateName(formData.get("name"));
      if (error) {
        return error;
      }
      redirect("/path");
      return null;
    },
    null,
  );

  return (
    <form action={submitAction}>
      <input type="text" name="name" />
      <button type="submit" disabled={isPending}>
        Update
      </button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

**Key behaviors:**
- Actions automatically manage pending state
- Optimistic updates via `useOptimistic`
- Error handling with Error Boundaries
- Automatic form reset after successful submission

---

## useActionState Hook

`useActionState` wraps an action function and returns `[state, wrappedAction, isPending]`.

```tsx
const [error, submitAction, isPending] = useActionState(
  async (previousState, newName) => {
    const error = await updateName(newName);
    if (error) {
      return error;
    }
    return null;
  },
  null, // initial state
);
```

**Parameters:**
- `action`: Async function receiving `(previousState, formData)`
- `initialState`: Initial value for the state
- `permalink?`: Optional URL for progressive enhancement

**Returns:**
- `state`: Last result of the action
- `action`: Wrapped action to pass to `<form action={}>`
- `isPending`: Boolean indicating if the action is in progress

---

## useOptimistic Hook

Shows optimistic UI while an async request is in progress.

```tsx
function ChangeName({ currentName, onUpdateName }) {
  const [optimisticName, setOptimisticName] = useOptimistic(currentName);

  const submitAction = async (formData) => {
    const newName = formData.get("name");
    setOptimisticName(newName);
    const updatedName = await updateName(newName);
    onUpdateName(updatedName);
  };

  return (
    <form action={submitAction}>
      <p>Your name is: {optimisticName}</p>
      <p>
        <label>Change Name:</label>
        <input
          type="text"
          name="name"
          disabled={currentName !== optimisticName}
        />
      </p>
    </form>
  );
}
```

**Key behavior:**
- Immediately renders `optimisticName` while the request is in progress
- Automatically reverts to `currentName` when the request finishes or errors
- The `disabled` prop prevents duplicate submissions

---

## use() API

A new API to read resources in render. Unlike hooks, `use()` can be called conditionally.

### Reading a Promise

```tsx
import { use, Suspense } from "react";

function Comments({ commentsPromise }) {
  // `use` will suspend until the promise resolves
  const comments = use(commentsPromise);
  return comments.map((comment) => <p key={comment.id}>{comment}</p>);
}

function Page({ commentsPromise }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Comments commentsPromise={commentsPromise} />
    </Suspense>
  );
}
```

### Reading Context Conditionally

```tsx
import { use } from "react";
import ThemeContext from "./ThemeContext";

function Heading({ children }) {
  if (children == null) {
    return null;
  }
  // This works! use() can be called after early returns
  const theme = use(ThemeContext);
  return <h1 style={{ color: theme.color }}>{children}</h1>;
}
```

**Important constraints:**
- `use()` cannot be called inside loops or conditions (like hooks)
- `use()` CAN be called after early returns (unlike `useContext`)
- Does not support promises created in render -- use cached promises from frameworks

---

## useFormStatus Hook

Reads the status of the parent `<form>` -- useful for design system components.

```tsx
import { useFormStatus } from "react-dom";

function DesignButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Submitting..." : "Submit"}
    </button>
  );
}
```

**Returns:**
- `pending`: Boolean indicating if the parent form is submitting
- `data`: FormData being submitted
- `method`: "get" or "post"
- `action`: Reference to the action function

**Constraint:** Must be called from a component rendered inside a `<form>`.

---

## ref as a Prop

Function components can now accept `ref` as a prop directly -- no more `forwardRef`.

### Before

```tsx
const MyInput = forwardRef(function MyInput({ placeholder }, ref) {
  return <input placeholder={placeholder} ref={ref} />;
});
```

### After

```tsx
function MyInput({ placeholder, ref }) {
  return <input placeholder={placeholder} ref={ref} />;
}
```

**Notes:**
- A codemod is available to automatically convert components
- `forwardRef` will be deprecated and removed in future versions
- Class component refs still work as before (they reference the instance)

---

## Context as Provider

Render `<Context>` directly as a provider instead of `<Context.Provider>`.

### Before

```tsx
const ThemeContext = createContext("");

function App({ children }) {
  return <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>;
}
```

### After

```tsx
const ThemeContext = createContext("");

function App({ children }) {
  return <ThemeContext value="dark">{children}</ThemeContext>;
}
```

A codemod is available to convert existing `<Context.Provider>` to the new syntax.

---

## React Server Components

Server Components render ahead of time, separate from the client application.

### Key Concepts

```tsx
// Server Component (default in Next.js App Router)
// Can directly access databases, file systems, etc.
async function UserProfile({ userId }) {
  const user = await db.users.findById(userId);
  return <div>{user.name}</div>;
}

// Client Component (opt-in with "use client")
"use client";
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

**Benefits:**
- Zero client-side JavaScript for server components
- Direct database/file access
- Automatic code splitting
- Improved SEO and initial load performance

---

## Server Actions

Async functions executed on the server, callable from Client Components.

```tsx
// Server Action
"use server";
export async function submitForm(formData) {
  const username = formData.get("username");
  const email = formData.get("email");

  await db.users.create({ username, email });
  redirect("/success");
}
```

```tsx
// Client Component using Server Action
import { submitForm } from "./actions";

function SignupForm() {
  return (
    <form action={submitForm}>
      <input type="text" name="username" />
      <input type="email" name="email" />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

---

## Document Metadata

Use `<title>`, `<meta>`, and `<link>` directly in components -- no more `react-helmet`.

```tsx
function BlogPost({ post }) {
  return (
    <>
      <title>{post.title} | My Blog</title>
      <meta name="description" content={post.excerpt} />
      <meta property="og:title" content={post.title} />
      <link rel="canonical" href={`https://example.com/posts/${post.slug}`} />
      <article>
        <h1>{post.title}</h1>
        <p>{post.content}</p>
      </article>
    </>
  );
}
```

---

## Asset Loading

New resource loading APIs for better control over when assets load.

```tsx
import { preload, preinit } from "react-dom";

function MyComponent() {
  // Preload a font
  preload("/fonts/main.woff2", { as: "font" });

  // Preload an image
  preload("/hero.png", { as: "image" });

  // Initialize a stylesheet
  preinit("/styles.css", { as: "style" });

  return <div>...</div>;
}
```

**Benefits:**
- Assets load in the background as users navigate
- Eliminates flash of unstyled content (FOUC)
- Integrates with Suspense boundaries

---

## React Compiler

Automatically memoizes components, eliminating the need for manual `useMemo`, `useCallback`, and `React.memo`.

### What It Does

- Automatically optimizes re-renders
- Decides which components to memoize
- Eliminates manual performance optimizations
- Already powering Instagram in production

### Current Status

The React Compiler is available as an experimental Babel plugin:

```bash
npm install babel-plugin-react-compiler
```

```js
// babel.config.js
module.exports = {
  plugins: ["babel-plugin-react-compiler"],
};
```

**Note:** The compiler works best with code that follows the Rules of React (pure render functions, no side effects in render).

---

## Static APIs

New APIs for static site generation with streaming support.

```tsx
import { prerender } from "react-dom/static";

async function handler(request) {
  const { prelude } = await prerender(<App />, {
    bootstrapScripts: ["/main.js"],
  });

  return new Response(prelude, {
    headers: { "content-type": "text/html" },
  });
}
```

**Available APIs:**
- `prerender()` -- Returns a Web Stream
- `prerenderToNodeStream()` -- Returns a Node.js Stream

Both wait for all data to load before returning static HTML.

---

## Hydration Error Improvements

React 19 provides clear, single-message error reporting with diffs for hydration mismatches.

```
Uncaught Error: Hydration failed because the server rendered HTML didn't match.
As a result this tree will be regenerated on the client. This can happen if
an SSR-ed Client Component used:
- A server/client branch if (typeof window !== 'undefined').
- Variable input such as Date.now() or Math.random().
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.
```

**Common causes to watch for:**
- `typeof window !== "undefined"` branching
- `Date.now()` or `Math.random()` in render
- Locale-dependent date formatting
- Browser extensions modifying HTML

---

## Upgrade Checklist

1. Run the React 19 codemods: `npx react-codemod@latest react-19/`
2. Replace `forwardRef` with `ref` prop
3. Replace `<Context.Provider>` with `<Context>`
4. Adopt `useActionState` for form handling
5. Remove manual `useMemo`/`useCallback` where the React Compiler is enabled
6. Test hydration -- watch for new error messages
7. Update TypeScript types (React 19 types are bundled)

---

*Sources: react.dev/blog/2024/12/05/react-19, freecodecamp.org, geeksforgeeks.org, telerik.com*
