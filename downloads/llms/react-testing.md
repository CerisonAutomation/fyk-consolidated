# React Testing Best Practices

> Compiled from community resources and official documentation (2024+)

---

## Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [Testing Philosophy](#testing-philosophy)
3. [Querying Elements](#querying-elements)
4. [User Interactions](#user-interactions)
5. [Testing Async Behavior](#testing-async-behavior)
6. [Mocking Patterns](#mocking-patterns)
7. [Testing Forms](#testing-forms)
8. [Testing Hooks](#testing-hooks)
9. [Testing Error Boundaries](#testing-error-boundaries)
10. [Testing Performance](#testing-performance)
11. [Snapshot Testing](#snapshot-testing)
12. [Accessibility Testing](#accessibility-testing)
13. [CI/CD Integration](#cicd-integration)
14. [Common Patterns & Recipes](#common-patterns--recipes)

---

## Setup & Configuration

### Vitest + React Testing Library

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Clean up after each test
afterEach(() => {
  cleanup();
});
```

### Vitest Config for Path Aliases

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    environment: "jsdom",
    alias: {
      "@": resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
    },
  },
});
```

---

## Testing Philosophy

Test from the **user's perspective**, not implementation details.

```tsx
// BAD: Testing implementation details
test("uses useState for count", () => {
  const { result } = renderHook(() => useCounter());
  expect(typeof result.current.count).toBe("number");
});

// GOOD: Testing behavior the user sees
test("increments count when button is clicked", async () => {
  render(<Counter />);
  expect(screen.getByText("Count: 0")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /increment/i }));
  expect(screen.getByText("Count: 1")).toBeInTheDocument();
});
```

**Core principles:**
- Test what the user sees and does
- Avoid testing internal state
- Avoid testing implementation details
- Use accessible queries (getByRole, getByText)
- Don't snapshot everything

---

## Querying Elements

### Priority Order for Queries

1. **getByRole** -- Best first choice (accessibility-friendly)
2. **getByLabelText** -- Best for form fields
3. **getByPlaceholderText** -- When no label is available
4. **getByText** -- For non-interactive content
5. **getByDisplayValue** -- For filled form inputs
6. **getByAltText** -- For images
7. **getByTitle** -- For elements with title attribute
8. **getByTestId** -- Last resort only

```tsx
// Query examples
screen.getByRole("button", { name: /submit/i });
screen.getByRole("textbox", { name: /email/i });
screen.getByRole("heading", { level: 2 });
screen.getByRole("navigation");
screen.getByRole("list");
screen.getByRole("listitem");

screen.getByLabelText("Email address");
screen.getByPlaceholderText("Search...");
screen.getByText("Welcome back");
screen.getByAltText("Company logo");
screen.getByTestId("user-profile");
```

### Query Variants

```tsx
// getBy* - throws if not found (use for asserting presence)
expect(screen.getByText("Hello")).toBeInTheDocument();

// queryBy* - returns null if not found (use for asserting absence)
expect(screen.queryByText("Error")).not.toBeInTheDocument();

// findBy* - async, waits for element to appear
const message = await screen.findByText(/success/i);
expect(message).toBeInTheDocument();

// getAllBy* / queryAllBy* / findAllBy* - for multiple elements
const items = screen.getAllByRole("listitem");
expect(items).toHaveLength(3);
```

---

## User Interactions

### Always Use userEvent (Not fireEvent)

```tsx
import userEvent from "@testing-library/user-event";

// Set up user event instance for realistic behavior
const user = userEvent.setup();

test("form submission flow", async () => {
  render(<ContactForm />);

  // Type into inputs
  await user.type(screen.getByRole("textbox", { name: /name/i }), "John");

  await user.type(
    screen.getByRole("textbox", { name: /email/i }),
    "john@example.com",
  );

  // Click checkbox
  await user.click(screen.getByRole("checkbox", { name: /subscribe/i }));

  // Select from dropdown
  await user.selectOptions(
    screen.getByRole("combobox", { name: /country/i }),
    "United States",
  );

  // Tab between fields
  await user.tab();

  // Click submit
  await user.click(screen.getByRole("button", { name: /submit/i }));

  // Assert success
  expect(
    await screen.findByText(/thank you/i),
  ).toBeInTheDocument();
});
```

### Keyboard Interactions

```tsx
test("keyboard navigation", async () => {
  render(<LoginForm />);
  const user = userEvent.setup();

  const emailInput = screen.getByRole("textbox", { name: /email/i });
  const passwordInput = screen.getByRole("textbox", { name: /password/i });

  // Type and tab
  await user.type(emailInput, "test@example.com");
  await user.tab();
  expect(passwordInput).toHaveFocus();

  // Press Enter to submit
  await user.type(passwordInput, "password123");
  await user.keyboard("{Enter}");

  expect(
    await screen.findByText(/welcome/i),
  ).toBeInTheDocument();
});
```

---

## Testing Async Behavior

### Mocking API Calls

```tsx
import { vi } from "vitest";
import axios from "axios";

vi.mock("axios");

test("fetches and displays user data", async () => {
  const mockUser = { id: 1, name: "John Doe", email: "john@example.com" };
  axios.get.mockResolvedValueOnce({ data: mockUser });

  render(<UserProfile userId={1} />);

  // Wait for loading to finish
  expect(await screen.findByText("John Doe")).toBeInTheDocument();
  expect(screen.getByText("john@example.com")).toBeInTheDocument();

  // Verify the API was called correctly
  expect(axios.get).toHaveBeenCalledWith("/api/users/1");
});
```

### MSW (Mock Service Worker) Pattern

```tsx
// src/test/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "John Doe",
      email: "john@example.com",
    });
  }),

  http.post("/api/users", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 1, ...body }, { status: 201 });
  }),

  http.get("/api/users", () => {
    return HttpResponse.json([
      { id: 1, name: "John" },
      { id: 2, name: "Jane" },
    ]);
  }),
];

// src/test/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```ts
// src/test/setup.ts
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```tsx
// In tests -- override handlers per test
test("handles API error", async () => {
  server.use(
    http.get("/api/users/:id", () => {
      return new HttpResponse(null, { status: 500 });
    }),
  );

  render(<UserProfile userId={1} />);
  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

---

## Mocking Patterns

### Mocking Modules

```tsx
import { vi } from "vitest";

// Mock entire module
vi.mock("./api", () => ({
  fetchUsers: vi.fn(),
  createUser: vi.fn(),
}));

// Mock specific function
import { fetchUsers } from "./api";
const mockFetchUsers = vi.mocked(fetchUsers);

test("loads users", async () => {
  mockFetchUsers.mockResolvedValueOnce([
    { id: 1, name: "John" },
  ]);

  render(<UserList />);
  expect(await screen.findByText("John")).toBeInTheDocument();
});
```

### Mocking localStorage

```tsx
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

beforeEach(() => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(
    localStorageMock.getItem,
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(
    localStorageMock.setItem,
  );
});
```

### Mocking Timers

```tsx
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

describe("debounced search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("debounces search input", async () => {
    render(<SearchInput />);

    await userEvent.type(screen.getByRole("textbox"), "react");

    // Timer hasn't fired yet
    expect(screen.queryByText(/searching/i)).not.toBeInTheDocument();

    // Advance timers
    vi.advanceTimersByTime(300);

    expect(screen.getByText(/searching/i)).toBeInTheDocument();
  });
});
```

---

## Testing Forms

### React Hook Form + Zod

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

test("validates and submits form", async () => {
  const onSubmit = vi.fn();
  render(<SignupForm onSubmit={onSubmit} />);

  const user = userEvent.setup();

  // Submit empty form -- should show errors
  await user.click(screen.getByRole("button", { name: /sign up/i }));
  expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  expect(screen.getByText(/email is required/i)).toBeInTheDocument();

  // Fill in valid data
  await user.type(screen.getByRole("textbox", { name: /name/i }), "John");
  await user.type(screen.getByRole("textbox", { name: /email/i }), "bad-email");

  // Submit -- should show email error
  await user.click(screen.getByRole("button", { name: /sign up/i }));
  expect(screen.getByText(/invalid email/i)).toBeInTheDocument();

  // Fix email
  await user.clear(screen.getByRole("textbox", { name: /email/i }));
  await user.type(
    screen.getByRole("textbox", { name: /email/i }),
    "john@example.com",
  );

  // Submit -- should succeed
  await user.click(screen.getByRole("button", { name: /sign up/i }));
  expect(onSubmit).toHaveBeenCalledWith({
    name: "John",
    email: "john@example.com",
  });
});
```

---

## Testing Hooks

### Using renderHook

```tsx
import { renderHook, act } from "@testing-library/react";
import { useCounter } from "./useCounter";

test("increments count", () => {
  const { result } = renderHook(() => useCounter(0));

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});

test("respects max value", () => {
  const { result } = renderHook(() => useCounter(10, { max: 10 }));

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(10);
});
```

### Testing Custom Hook with Dependencies

```tsx
test("useFetch loads data", async () => {
  const { result } = renderHook(() => useFetch("/api/users"));

  // Initially loading
  expect(result.current.loading).toBe(true);
  expect(result.current.data).toBeNull();

  // Wait for data
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.data).toEqual([
    { id: 1, name: "John" },
  ]);
});
```

---

## Testing Error Boundaries

```tsx
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// Throw error in child component
function BuggyComponent() {
  throw new Error("Test error");
}

test("catches errors and displays fallback", () => {
  // Suppress console.error for this test
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <ErrorBoundary>
      <BuggyComponent />
    </ErrorBoundary>,
  );

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();

  consoleSpy.mockRestore();
});
```

---

## Testing Performance

### Testing Render Count

```tsx
test("parent re-render does not re-render memoized child", () => {
  let childRenderCount = 0;

  const Child = React.memo(({ value }) => {
    childRenderCount++;
    return <div>{value}</div>;
  });

  function Parent() {
    const [, forceRender] = useReducer((x) => x + 1, 0);
    return (
      <div>
        <Child value="static" />
        <button onClick={forceRender}>Re-render</button>
      </div>
    );
  }

  render(<Parent />);
  expect(childRenderCount).toBe(1);

  // Parent re-renders, but Child should not
  fireEvent.click(screen.getByRole("button"));
  expect(childRenderCount).toBe(1);
});
```

---

## Snapshot Testing

### When to Use Snapshots

```tsx
// Good: Simple component snapshot
test("renders correctly", () => {
  const { container } = render(<Button variant="primary">Click me</Button>);
  expect(container).toMatchSnapshot();
});

// Bad: Component with dynamic data
// Don't snapshot lists, data-driven content, or time-sensitive output
```

### Updating Snapshots

```bash
# Update all snapshots
npx vitest --update

# Update specific test file
npx vitest --update src/Button.test.tsx
```

---

## Accessibility Testing

```tsx
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

test("has no accessibility violations", async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test("button is accessible", () => {
  render(<Button>Submit</Button>);

  const button = screen.getByRole("button", { name: /submit/i });
  expect(button).toBeInTheDocument();
  expect(button).not.toHaveAttribute("aria-disabled", "true");
});
```

---

## CI/CD Integration

### package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test"
  }
}
```

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm test:run
      - run: pnpm test:coverage
```

---

## Common Patterns & Recipes

### Testing Loading States

```tsx
test("shows loading state then data", async () => {
  render(<UserProfile userId={1} />);

  // Loading state
  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  // Data loaded
  expect(await screen.findByText("John Doe")).toBeInTheDocument();
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});
```

### Testing Conditional Rendering

```tsx
test("shows login form when not authenticated", () => {
  render(<App isAuthenticated={false} />);
  expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument();
});

test("shows dashboard when authenticated", () => {
  render(<App isAuthenticated={true} />);
  expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /log in/i })).not.toBeInTheDocument();
});
```

### Testing with Router

```tsx
import { MemoryRouter } from "react-router-dom";

test("renders home page", () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByText(/welcome/i)).toBeInTheDocument();
});

test("renders user profile page", () => {
  render(
    <MemoryRouter initialEntries={["/users/1"]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.getByText(/user profile/i)).toBeInTheDocument();
});
```

### Testing Context Providers

```tsx
function renderWithProviders(ui, options = {}) {
  const { initialEntries = ["/"], ...renderOptions } = options;

  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

test("renders within providers", () => {
  renderWithProviders(<Dashboard />);
  expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
});
```

---

## Quick Reference: Assertions

| Assertion | Purpose |
|-----------|---------|
| `toBeInTheDocument()` | Element exists in DOM |
| `not.toBeInTheDocument()` | Element does not exist |
| `toHaveTextContent(text)` | Element contains text |
| `toHaveAttribute(attr, value)` | Element has attribute |
| `toHaveValue(value)` | Input has value |
| `toBeVisible()` | Element is visible |
| `toHaveClass(class)` | Element has CSS class |
| `toBeDisabled()` | Element is disabled |
| `toHaveFocus()` | Element has focus |
| `toBeRequired()` | Element is required |

---

*Sources: robinwieruch.de, testing-library.com, vitest.dev*
