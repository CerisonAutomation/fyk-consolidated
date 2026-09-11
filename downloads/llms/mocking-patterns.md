# Mocking Patterns: Vitest & Jest

## Table of Contents

1. [Mock Functions (vi.fn)](#mock-functions)
2. [Spies (vi.spyOn)](#spies)
3. [Module Mocking (vi.mock)](#module-mocking)
4. [Partial Mocking](#partial-mocking)
5. [Class Mocking](#class-mocking)
6. [Timer Mocking](#timer-mocking)
7. [Global & Environment Mocking](#global--environment-mocking)
8. [Network & API Mocking](#network--api-mocking)
9. [Mock Clearing & Restoration](#mock-clearing--restoration)
10. [Advanced Patterns](#advanced-patterns)
11. [Common Pitfalls](#common-pitfalls)

---

## Mock Functions

### Basic Usage

```typescript
import { vi, expect, it } from 'vitest'

// Create a mock function
const mockFn = vi.fn()

// Call it
mockFn('hello', 1)

// Verify calls
expect(mockFn).toHaveBeenCalledWith('hello', 1)
expect(mockFn).toHaveBeenCalledTimes(1)
```

### Mock with Implementation

```typescript
// Static return value
const mockFn = vi.fn().mockReturnValue(42)
expect(mockFn()).toBe(42)

// Return different values on consecutive calls
const mockFn = vi.fn()
  .mockReturnValueOnce('first')
  .mockReturnValueOnce('second')
  .mockReturnValue('default')

expect(mockFn()).toBe('first')
expect(mockFn()).toBe('second')
expect(mockFn()).toBe('default')
expect(mockFn()).toBe('default')  // Continues returning 'default'

// Async return values
const mockAsyncFn = vi.fn()
  .mockResolvedValueOnce('async first')
  .mockResolvedValueOnce('async second')

expect(await mockAsyncFn()).toBe('async first')
expect(await mockAsyncFn()).toBe('async second')

// Mock with implementation function
const mockFn = vi.fn((a, b) => a + b)
expect(mockFn(2, 3)).toBe(5)

// Mock that throws
const mockFn = vi.fn().mockImplementation(() => {
  throw new Error('Mock error')
})
expect(() => mockFn()).toThrow('Mock error')
```

### Inspecting Mock State

```typescript
const mockFn = vi.fn()
mockFn('a')
mockFn('b', 2)

// All calls
expect(mockFn.mock.calls).toEqual([['a'], ['b', 2]])

// Number of calls
expect(mockFn.mock.calls.length).toBe(2)

// Arguments of specific call
expect(mockFn.mock.calls[0]).toEqual(['a'])
expect(mockFn.mock.calls[1]).toEqual(['b', 2])

// Return values
expect(mockFn.mock.results).toEqual([
  { type: 'return', value: undefined },
  { type: 'return', value: undefined },
])

// Thrown errors
const errorMock = vi.fn().mockImplementation(() => { throw new Error() })
try { errorMock() } catch {}
expect(errorMock.mock.results[0]).toEqual({
  type: 'throw',
  value: expect.any(Error),
})

// This context (if called with .call or .apply)
const obj = { fn: vi.fn() }
obj.fn.call(obj, 'arg')
expect(mockFn.mock.contexts[0]).toBe(obj)
```

---

## Spies

### Spying on Object Methods

```typescript
import * as mathModule from './math.js'

// Spy on an existing method
const spy = vi.spyOn(mathModule, 'add')

mathModule.add(1, 2)

expect(spy).toHaveBeenCalledWith(1, 2)
expect(spy).toHaveBeenCalledTimes(1)

// Restore original implementation
spy.mockRestore()
```

### Spy with Mock Implementation

```typescript
const spy = vi.spyOn(mathModule, 'add')
  .mockImplementation((a: number, b: number) => a * b)

expect(mathModule.add(2, 3)).toBe(6)  // Uses mock

spy.mockRestore()
expect(mathModule.add(2, 3)).toBe(5)  // Uses original
```

### Spying on Console

```typescript
const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

console.log('test output')

expect(spy).toHaveBeenCalledWith('test output')

spy.mockRestore()
```

### Spying on Object Properties (Getters/Setters)

```typescript
const obj = { _value: 'initial' }

// Spy on getter
vi.spyOn(obj, '_value', 'get').mockReturnValue('mocked')
expect(obj._value).toBe('mocked')

// Spy on setter
const setterSpy = vi.fn()
vi.spyOn(obj, '_value', 'set')
// Note: Property descriptor spying requires manual implementation
```

### Spy on Exported Variables

```typescript
// example.js
export let counter = 0
export function increment() { counter++ }

// test.js
import * as exports from './example.js'

vi.spyOn(exports, 'counter', 'get').mockReturnValue(42)
expect(exports.counter).toBe(42)
```

---

## Module Mocking

### Full Module Mock

```typescript
vi.mock('./api', () => ({
  fetchData: vi.fn(),
  processData: vi.fn(),
}))

import { fetchData, processData } from './api'

test('uses mocked api', async () => {
  fetchData.mockResolvedValue({ data: 'test' })
  processData.mockReturnValue('processed')

  const result = await fetchData()
  expect(result).toEqual({ data: 'test' })
})
```

### Auto-Mocking

```typescript
// Auto-mock entire module (all exports become vi.fn())
vi.mock('./api')

// The auto-mock replaces all exports with vi.fn()
// that return undefined by default
```

### Mocking with Import Original

```typescript
vi.mock('./api', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,  // Keep all original exports
    fetchData: vi.fn().mockResolvedValue({ mocked: true }),
  }
})

test('uses real module with mocked fetchData', async () => {
  // processData uses original implementation
  // fetchData uses mock
  const result = await fetchData()
  expect(result).toEqual({ mocked: true })
})
```

### Mocking External Packages

```typescript
// Mock a node_modules package
vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: 'mocked data' }),
    post: vi.fn().mockResolvedValue({ id: 1 }),
  },
}))

// Mock with partial
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: '123' }),
  }
})
```

### Virtual Modules

```typescript
// Create a mock for a module that doesn't exist
vi.mock('virtual:svg', () => ({
  default: 'svg-mock',
}))

// Or mock based on path pattern
vi.mock(/^\.\/locales\//, () => ({
  default: { hello: 'Hello' },
}))
```

---

## Partial Mocking

### Mock One Export, Keep Others

```typescript
// Original module has: exportA, exportB, exportC

vi.mock('./module', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,           // Keep exportB and exportC
    exportA: vi.fn(), // Mock exportA
  }
})
```

### Mock Only Specific Named Exports

```typescript
vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getUser: vi.fn().mockResolvedValue({ name: 'Mock User' }),
    // getUserList remains original
  }
})
```

### Mock Implementation that Calls Original

```typescript
vi.mock('./utils', async (importOriginal) => {
  const mod = await importOriginal()
  return {
    ...mod,
    formatData: vi.fn((data) => {
      // Add extra processing to original
      const original = mod.formatData(data)
      return `[FORMATTED] ${original}`
    }),
  }
})
```

---

## Class Mocking

### Full Class Mock

```typescript
vi.mock('./Database', () => {
  return {
    Database: vi.fn().mockImplementation(() => ({
      connect: vi.fn(),
      query: vi.fn().mockResolvedValue([]),
      disconnect: vi.fn(),
    })),
  }
})
```

### Class Mock with Inheritance

```typescript
vi.mock('./DataService', () => {
  const MockDataService = vi.fn(function(this: any) {
    this.fetch = vi.fn()
    this.save = vi.fn()
  })

  // Add static methods
  MockDataService.create = vi.fn().mockImplementation(() => {
    return new MockDataService()
  })

  return { DataService: MockDataService }
})
```

### Class Mock Preserving Type

```typescript
import { vi } from 'vitest'

interface MockDatabase {
  connect(): Promise<void>
  query(sql: string): Promise<any[]>
  disconnect(): Promise<void>
}

vi.mock('./Database', () => ({
  Database: vi.fn((): MockDatabase => ({
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([]),
    disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}))
```

### Spying on Class Methods

```typescript
import { Database } from './Database'

const db = new Database()

// Spy on instance method
const spy = vi.spyOn(db, 'query')

await db.query('SELECT 1')

expect(spy).toHaveBeenCalledWith('SELECT 1')
```

---

## Timer Mocking

### Basic Timer Mocking

```typescript
test('delayed execution', () => {
  vi.useFakeTimers()

  const callback = vi.fn()

  setTimeout(callback, 1000)

  // Time hasn't passed yet
  expect(callback).not.toHaveBeenCalled()

  // Advance time by 1 second
  vi.advanceTimersByTime(1000)
  expect(callback).toHaveBeenCalledTimes(1)

  vi.useRealTimers()
})
```

### Date Mocking

```typescript
test('fixed date', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))

  expect(new Date().toISOString()).toBe('2024-01-15T12:00:00.000Z')
  expect(Date.now()).toBe(new Date('2024-01-15T12:00:00Z').getTime())

  vi.useRealTimers()
})
```

### Interval Mocking

```typescript
test('interval execution', () => {
  vi.useFakeTimers()

  const callback = vi.fn()

  setInterval(callback, 500)

  vi.advanceTimersByTime(2000)

  expect(callback).toHaveBeenCalledTimes(4)

  vi.useRealTimers()
})
```

### Timer Methods

```typescript
vi.useFakeTimers()

// Advance all timers
vi.runAllTimers()

// Advance to next timer
vi.advanceTimersToNextTimer()

// Advance to specific time
vi.advanceTimersByTime(5000)
vi.advanceTimersToNextTimer(3)  // Skip 3 timers

// Run only pending timers
vi.runOnlyPendingTimers()

// Get timer count
expect(vi.getTimerCount()).toBe(2)

vi.useRealTimers()
```

### Mocking Promises with Timers

```typescript
test('async with fake timers', async () => {
  vi.useFakeTimers()

  const fetchPromise = fetchData()

  // Advance to resolve the promise
  vi.advanceTimersByTime(1000)

  const result = await fetchPromise
  expect(result).toEqual({ data: 'mocked' })

  vi.useRealTimers()
})
```

### Auto-Reset in Config

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    fakeTimers: {
      toFake: ['setTimeout', 'setInterval', 'Date'],
      // Don't fake: clearTimeout, clearInterval, performance.now
    },
  },
})
```

---

## Global & Environment Mocking

### Mock Global Variables

```typescript
// Mock a global variable
vi.stubGlobal('__VERSION__', '1.0.0')
expect(__VERSION__).toBe('1.0.0')

// Mock multiple globals
vi.stubGlobal('navigator', {
  userAgent: 'mock-agent',
  platform: 'mock-platform',
})

// Cleanup
vi.unstubAllGlobals()
```

### Mock Environment Variables

```typescript
// Mock import.meta.env (Vite)
vi.stubEnv('VITE_API_URL', 'http://mock-api.com')
vi.stubEnv('NODE_ENV', 'test')

// Access mocked env
import.meta.env.VITE_API_URL  // 'http://mock-api.com'

// Cleanup
vi.unstubAllEnvs()
```

### Auto-Unstub in Config

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    unstubEnvs: true,      // Auto-unstub envs after each test
    unstubGlobals: true,   // Auto-unstub globals after each test
  },
})
```

### Mock localStorage/sessionStorage

```typescript
// Already available in jsdom environment
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

test('stores data', () => {
  localStorage.setItem('token', 'abc123')
  expect(localStorage.getItem('token')).toBe('abc123')
})
```

---

## Network & API Mocking

### Mock fetch

```typescript
// Global fetch mock
beforeEach(() => {
  vi.restoreAllMocks()
})

test('API call', async () => {
  const mockData = { users: [{ id: 1, name: 'John' }] }

  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => mockData,
  } as Response)

  const result = await fetchUsers()

  expect(fetch).toHaveBeenCalledWith('/api/users')
  expect(result).toEqual(mockData)
})
```

### Mock fetch with Different Responses

```typescript
test('handles different endpoints', async () => {
  vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/users') {
      return { ok: true, json: async () => [{ id: 1 }] } as Response
    }
    if (url === '/api/posts') {
      return { ok: true, json: async () => [{ id: 1, title: 'Post' }] } as Response
    }
    return { ok: false } as Response
  })

  const users = await fetch('/api/users')
  expect(await users.json()).toEqual([{ id: 1 }])
})
```

### MSW (Mock Service Worker) Pattern

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'John' },
    ])
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: 2, ...body }, { status: 201 })
  }),

  http.get('/api/users/:id', ({ params }) => {
    if (params.id === '999') {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return HttpResponse.json({ id: params.id, name: 'John' })
  }),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Override handlers per test
test('custom response', async () => {
  server.use(
    http.get('/api/users', () => {
      return HttpResponse.json([{ id: 999, name: 'Custom' }])
    })
  )

  const users = await fetchUsers()
  expect(users).toEqual([{ id: 999, name: 'Custom' }])
})
```

---

## Mock Clearing & Restoration

### Difference Between Methods

```typescript
const mockFn = vi.fn()
mockFn.mockReturnValue('mocked')
mockFn('a')
mockFn('b')

// clearAllMocks - clears call history, keeps implementation
vi.clearAllMocks()
expect(mockFn.mock.calls.length).toBe(0)     // Cleared
mockFn('c')
expect(mockFn.mock.calls.length).toBe(1)     // New call recorded

// resetAllMocks - clears history AND implementation
vi.resetAllMocks()
expect(mockFn()).toBe(undefined)              // No return value
mockFn.mockReturnValue('new')
expect(mockFn()).toBe('new')

// restoreAllMocks - restores original implementation
const spy = vi.spyOn(console, 'log')
vi.restoreAllMocks()
// console.log is restored to original
```

### Config Options

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    clearMocks: true,    // Runs vi.clearAllMocks() before each test
    mockReset: true,     // Runs vi.resetAllMocks() before each test
    restoreMocks: true,  // Runs vi.restoreAllMocks() before each test
  },
})
```

### Manual Cleanup Pattern

```typescript
afterEach(() => {
  vi.clearAllMocks()
})

// Or for complete cleanup
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
```

---

## Advanced Patterns

### Mock Chaining

```typescript
const mockFn = vi.fn()
  .mockReturnValueOnce(1)
  .mockReturnValueOnce(2)
  .mockReturnValue(3)
  .mockName('counter')  // Name for better error messages

expect(mockFn()).toBe(1)
expect(mockFn()).toBe(2)
expect(mockFn()).toBe(3)
expect(mockFn()).toBe(3)
```

### Mock with Conditional Implementation

```typescript
const mockFn = vi.fn((input: number) => {
  if (input < 0) throw new Error('Negative')
  return input * 2
})

expect(mockFn(5)).toBe(10)
expect(() => mockFn(-1)).toThrow('Negative')
```

### Mock Return Values by Argument

```typescript
const mockFn = vi.fn()
  .mockImplementation((arg: string) => {
    switch (arg) {
      case 'a': return 1
      case 'b': return 2
      default: return 0
    }
  })

expect(mockFn('a')).toBe(1)
expect(mockFn('b')).toBe(2)
expect(mockFn('c')).toBe(0)
```

### Mocking with vi.hoisted

```typescript
// vi.hoisted runs before imports (like vi.mock but for variables)
const { mockFn } = vi.hoisted(() => {
  const mockFn = vi.fn()
  return { mockFn }
})

// Use in vi.mock factory (which is hoisted)
vi.mock('./api', () => ({
  fetchData: mockFn,
}))
```

### Mock with Generics

```typescript
function createMock<T extends (...args: any[]) => any>() {
  return vi.fn<T>() as ReturnType<typeof vi.fn<T>>
}

const mockFetch = createMock<() => Promise<Response>>()
mockFetch.mockResolvedValue(new Response('ok'))
```

### Snapshot Testing with Mocks

```typescript
test('mock call snapshot', () => {
  const mockFn = vi.fn()
  mockFn({ name: 'test', value: 42 })

  expect(mockFn.mock.calls).toMatchInlineSnapshot(`
    [
      [
        {
          "name": "test",
          "value": 42,
        },
      ],
    ]
  `)
})
```

---

## Common Pitfalls

### 1. vi.mock is Hoisted

```typescript
// This does NOT work:
const myMock = vi.fn()
vi.mock('./api', () => ({ fetch: myMock }))  // myMock is undefined

// Solution: Use vi.hoisted
const { myMock } = vi.hoisted(() => ({
  myMock: vi.fn(),
}))
vi.mock('./api', () => ({ fetch: myMock }))  // Works
```

### 2. Mock Scope

```typescript
// vi.mock is hoisted to top of file
vi.mock('./api')  // This runs first

import { fetchData } from './api'  // This gets the mocked version

// If you need dynamic mocking, use vi.doMock instead
test('dynamic mock', async () => {
  vi.doMock('./api', () => ({
    fetchData: vi.fn().mockResolvedValue('dynamic'),
  }))

  const { fetchData } = await import('./api')
  expect(await fetchData()).toBe('dynamic')
})
```

### 3. Mock Cleanup Between Tests

```typescript
// WITHOUT cleanup, mocks persist between tests
// Test 1: mock returns 'a'
// Test 2: mock still returns 'a' (from test 1's mockReturnValueOnce)

// WITH cleanup
afterEach(() => {
  vi.clearAllMocks()
})
```

### 4. Import Order Matters

```typescript
// vi.mock must be called before the import
import { fetchData } from './api'  // Import after mock
vi.mock('./api', () => ({
  fetchData: vi.fn(),
}))
// fetchData is now mocked
```

### 5. Browser Mode Limitations

```typescript
// In Browser Mode, vi.spyOn on exports does not work
// Use vi.mock or mock the global object instead
```
