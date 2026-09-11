# Vitest Testing Patterns & Best Practices

## Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [Test Organization](#test-organization)
3. [Assertions](#assertions)
4. [Snapshot Testing](#snapshot-testing)
5. [Type Testing](#type-testing)
6. [Benchmarking](#benchmarking)
7. [In-Source Testing](#in-source-testing)
8. [Browser Mode](#browser-mode)
9. [Watch Mode](#watch-mode)
10. [Performance](#performance)
11. [Project Structure](#project-structure)

---

## Setup & Configuration

### Installation

```bash
npm install -D vitest
```

### Basic Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,           // Provide describe, it, expect as globals
    environment: 'jsdom',    // 'jsdom' | 'happy-dom' | 'node'
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./src/test/setup.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    testTimeout: 5000,
    hookTimeout: 5000,
    teardownTimeout: 10000,
  },
})
```

### Environment Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
        pretendToBeVisual: true,
      },
    },
  },
})
```

### Auto-Mock Cleanup

```typescript
export default defineConfig({
  test: {
    clearMocks: true,       // Calls vi.clearAllMocks() before each test
    mockReset: true,        // Calls vi.resetAllMocks() before each test
    restoreMocks: true,     // Calls vi.restoreAllMocks() before each test
    unstubEnvs: true,       // Auto-unstub envs after each test
    unstubGlobals: true,    // Auto-unstub globals after each test
  },
})
```

### Setup Files

```typescript
// src/test/setup.ts
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cleanup after each test (React Testing Library)
afterEach(() => {
  cleanup()
})

// Custom global setup
import '@testing-library/jest-dom/vitest'
```

### Global Setup (runs once before all tests)

```typescript
// src/test/global-setup.ts
import type { GlobalSetupContext } from 'vitest/node'

export function setup({ provide }: GlobalSetupContext) {
  // Start test database, seed data, etc.
  console.log('Global setup: starting test services...')
}

export function teardown() {
  console.log('Global teardown: cleaning up...')
}
```

### Extending Base Config

```typescript
// vitest.config.ts
import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
  },
}))
```

---

## Test Organization

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest'

describe('Calculator', () => {
  describe('addition', () => {
    it('adds two positive numbers', () => {
      expect(add(1, 2)).toBe(3)
    })

    it('handles negative numbers', () => {
      expect(add(-1, -2)).toBe(-3)
    })
  })
})
```

### Concurrent Tests

```typescript
describe('parallel tests', () => {
  // All tests in this block run in parallel
  it.concurrent('test 1', async () => { /* ... */ })
  it.concurrent('test 2', async () => { /* ... */ })
  it.concurrent('test 3', async () => { /* ... */ })
})

// Or mark entire describe block
describe.concurrent('all parallel', () => {
  it('test 1', async () => { /* ... */ })
  it('test 2', async () => { /* ... */ })
})
```

### Skip and Only

```typescript
it.skip('skipped test', () => { /* ... */ })
it.only('only this test runs', () => { /* ... */ })
it.todo('todo: implement later')

// Conditional skip
it.skipIf(process.env.CI)('skip in CI', () => { /* ... */ })
it.runIf(process.env.CI)('only run in CI', () => { /* ... */ })
```

### Test Retry & Repeat

```typescript
export default defineConfig({
  test: {
    retry: 2,           // Retry failed tests up to 2 times
    repeats: 3,         // Run each test 3 times
    bail: 3,            // Stop after 3 failures
  },
})
```

### Test Ordering

```typescript
export default defineConfig({
  test: {
    sequence: {
      concurrent: false,           // Run files serially
      shuffle: true,               // Randomize test order
      setupFiles: 'list',          // Run setup files in listed order
    },
  },
})
```

### Fixtures

```typescript
import { test, expect } from 'vitest'

// Define custom fixtures
test.extend<{ todoPage: TodoPage }>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page)
    await todoPage.goto()
    await use(todoPage)
    // Cleanup runs automatically after test
    await todoPage.clearAll()
  },
})

test('displays todo items', async ({ todoPage }) => {
  await todoPage.addTodo('Buy milk')
  expect(await todoPage.getCount()).toBe(1)
})
```

---

## Assertions

### Basic Matchers

```typescript
// Equality
expect(value).toBe(expected)         // Strict equality (===)
expect(obj).toEqual(expected)        // Deep equality
expect(value).toBeUndefined()
expect(value).toBeDefined()
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()

// Numbers
expect(value).toBeGreaterThan(3)
expect(value).toBeGreaterThanOrEqual(3)
expect(value).toBeLessThan(5)
expect(value).toBeCloseTo(0.3, 5)    // Float comparison

// Strings
expect(string).toMatch(/regexp/)
expect(string).toContain('substr')

// Arrays
expect(array).toContain(item)
expect(array).toHaveLength(3)

// Objects
expect(obj).toHaveProperty('key')
expect(obj).toHaveProperty('key', 'value')
expect(obj).toMatchObject({ key: 'value' })
expect(obj).toMatchInlineSnapshot(`{...}`)
```

### Exception Testing

```typescript
it('throws on invalid input', () => {
  expect(() => parseInput('bad')).toThrow()
  expect(() => parseInput('bad')).toThrow('Invalid input')
  expect(() => parseInput('bad')).toThrow(Error)
  expect(() => parseInput('bad')).toThrowError('Invalid input')
})

// Async exception testing
it('rejects on error', async () => {
  await expect(fetchData()).rejects.toThrow('Network error')
  await expect(fetchData()).rejects.toThrowError('Network error')
})
```

### Custom Matchers

```typescript
// Extend expect with custom matchers
import { expect } from 'vitest'

interface CustomMatchers<R = unknown> {
  toBeWithinRange(a: number, b: number): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    return {
      pass,
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be within range ${floor} - ${ceiling}`,
    }
  },
})

// Usage
expect(receivedValue).toBeWithinRange(1, 10)
```

---

## Snapshot Testing

```typescript
import { it, expect } from 'vitest'

it('matches inline snapshot', () => {
  expect({ name: 'John', age: 30 }).toMatchInlineSnapshot(`
    {
      "age": 30,
      "name": "John",
    }
  `)
})

it('matches external snapshot', () => {
  expect(component.render()).toMatchSnapshot()
})

it('matches snapshot file', () => {
  expect(component.render()).toMatchFileSnapshot('./__snapshots__/output.html')
})

// Object matching (partial snapshot)
it('matches partial snapshot', () => {
  expect(data).toMatchObject({
    name: expect.any(String),
    id: expect.any(Number),
  })
})
```

---

## Type Testing

```typescript
import { it, expectTypeOf } from 'vitest'

it('returns correct type', () => {
  const result = getUser()
  expectTypeOf(result).toEqualTypeOf<{ name: string; age: number }>()
  expectTypeOf(result.name).toBeString()
  expectTypeOf(result.age).toBeNumber()
})

// Compile-time error checking
it('type narrowing works', () => {
  const value = processValue('hello')
  expectTypeOf(value).not.toBeAny()
  expectTypeOf(value).toMatchTypeOf<{ type: string }>()
})
```

---

## Benchmarking

```typescript
import { bench, describe, expect } from 'vitest'

describe('performance benchmarks', () => {
  bench('sort algorithm', () => {
    const arr = Array.from({ length: 1000 }, () => Math.random())
    arr.sort((a, b) => a - b)
  }, { time: 1000 })  // Run for 1 second

  bench('hash map lookups', () => {
    const map = new Map()
    for (let i = 0; i < 1000; i++) map.set(i, i)
    for (let i = 0; i < 1000; i++) map.get(i)
  })

  // Compare implementations
  describe('array methods', () => {
    const arr = Array.from({ length: 1000 }, () => Math.random())

    bench('for loop', () => {
      for (let i = 0; i < arr.length; i++) { arr[i] }
    })

    bench('for...of', () => {
      for (const x of arr) { x }
    })

    bench('forEach', () => {
      arr.forEach(x => { x })
    })
  })
})
```

---

## In-Source Testing

```typescript
// src/utils.ts
export function add(a: number, b: number): number {
  return a + b
}

// In-source tests (Rust-like pattern)
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  describe('add', () => {
    it('adds two numbers', () => {
      expect(add(1, 2)).toBe(3)
    })

    it('handles negatives', () => {
      expect(add(-1, -2)).toBe(-3)
    })
  })
}
```

Enable in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    includeSource: ['src/**/*.{ts,tsx}'],
  },
})
```

---

## Browser Mode

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',  // or 'webdriverio'
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
})
```

---

## Watch Mode

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    watch: true,  // Default in dev
  },
})
```

Watch mode commands:
- `p` - Filter by filename pattern
- `t` - Filter by test name
- `i` - Toggle invert pattern
- `u` - Update snapshots
- `s` - Toggle silent mode
- `q` - Quit watch mode

---

## Performance

### Thread Pool Configuration

```typescript
export default defineConfig({
  test: {
    pool: 'forks',           // 'threads' | 'forks' | 'vmThreads'
    poolOptions: {
      forks: {
        singleFork: true,    // Use single fork for memory-constrained
        maxForks: 4,
        minForks: 1,
      },
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
    fileParallelism: true,   // Parallel test files
    maxWorkers: 4,
  },
})
```

### Sharding (CI)

```bash
# Run 1 of 3 shards
npx vitest --shard=1/3

# Run 2 of 3 shards
npx vitest --shard=2/3
```

### Test Isolation

```typescript
export default defineConfig({
  test: {
    isolate: true,  // Isolate test files (default: true)
    // Disable for speed in unit tests
    // enable for integration tests
  },
})
```

---

## Project Structure

### Recommended Directory Layout

```
src/
  components/
    Button.tsx
    Button.test.tsx       # Co-located tests
  utils/
    helpers.ts
    helpers.test.ts
  hooks/
    useAuth.ts
    useAuth.test.ts
test/
  setup.ts                # Per-suite setup
  global-setup.ts         # One-time setup
  fixtures/               # Test data
vitest.config.ts
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "bench": "vitest bench"
  }
}
```

### Multi-Project (Workspace) Config

```typescript
// vitest.workspace.ts
export default [
  {
    test: {
      name: 'unit',
      include: ['src/**/*.unit.test.ts'],
    },
  },
  {
    test: {
      name: 'integration',
      include: ['src/**/*.integration.test.ts'],
    },
  },
]
```
