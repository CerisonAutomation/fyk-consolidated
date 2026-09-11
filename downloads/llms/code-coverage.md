# Code Coverage Best Practices

## Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [Coverage Providers](#coverage-providers)
3. [Coverage Reports](#coverage-reports)
4. [Coverage Thresholds](#coverage-thresholds)
5. [Including & Excluding Files](#including--excluding-files)
6. [Ignoring Code](#ignoring-code)
7. [CI/CD Integration](#cicd-integration)
8. [Coverage Metrics](#coverage-metrics)
9. [Best Practices](#best-practices)
10. [Common Patterns](#common-patterns)

---

## Setup & Configuration

### Vitest Coverage

```bash
# Install coverage provider
npm install -D @vitest/coverage-v8    # Recommended
# or
npm install -D @vitest/coverage-istanbul
```

### Basic Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: 'v8',         // 'v8' | 'istanbul'
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
    },
  },
})
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:coverage:open": "vitest run --coverage --coverage.reporter=html && open coverage/index.html"
  }
}
```

---

## Coverage Providers

### V8 Provider (Recommended)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
    },
  },
})
```

**Advantages:**
- Uses native V8 engine coverage
- Faster execution
- Lower memory usage
- Provides identical coverage reports to Istanbul (since v3.2.0)
- Uses AST-based remapping

### Istanbul Provider

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
    },
  },
})
```

**Advantages:**
- Works on any JavaScript runtime
- Widely used and battle-tested
- More configuration options

### Provider Comparison

| Feature | V8 | Istanbul |
|---------|-----|----------|
| Speed | Faster | Slower |
| Memory | Lower | Higher |
| Runtime | V8-based only | Any JS runtime |
| Reports | Same as Istanbul | Same |
| Setup | Simpler | More options |

---

## Coverage Reports

### Built-in Reporters

```typescript
export default defineConfig({
  test: {
    coverage: {
      reporter: [
        'text',           // Console output
        'text-summary',   // Console summary
        'html',           // HTML report
        'lcov',           // LCOV format
        'json',           // JSON report
        'json-summary',   // JSON summary
        'cobertura',      // Cobertura XML
        'clover',         // Clover XML
        'teamcity',       // TeamCity format
        'dot',            // Dot reporter
        'ioson',          // ISON reporter
        'inception',      // Inception reporter
        'text-details',   // Detailed text
      ],
    },
  },
})
```

### Custom Reporter Configuration

```typescript
export default defineConfig({
  test: {
    coverage: {
      reporter: [
        ['html', { subdir: 'html-report' }],
        ['json', { file: 'coverage.json' }],
        ['text', { skipFull: true }],  // Skip files with 100% coverage
        ['lcov', { projectRoot: './src' }],
      ],
    },
  },
})
```

### HTML Report

```typescript
export default defineConfig({
  test: {
    coverage: {
      reporter: ['html'],
      reportsDirectory: './coverage',
    },
  },
})

// Open HTML report
// npx vitest run --coverage && open coverage/index.html
```

### Multiple Reporters for CI

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      reporter: process.env.CI
        ? ['lcov', 'json-summary', 'text']
        : ['text', 'html'],
    },
  },
})
```

---

## Coverage Thresholds

### Basic Thresholds

```typescript
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        // Minimum coverage percentages (fail if below)
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
```

### Per-Directory Thresholds

```typescript
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        // Global thresholds
        lines: 80,
        functions: 80,

        // Per-file or per-pattern thresholds
        'src/core/**': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'src/utils/**': {
          lines: 70,
          functions: 60,
        },
      },
    },
  },
})
```

### Auto-Clear with Thresholds

```typescript
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        // Automatically update thresholds when coverage improves
        autoUpdate: true,
      },
    },
  },
})
```

---

## Including & Excluding Files

### Include Specific Files

```typescript
export default defineConfig({
  test: {
    coverage: {
      include: [
        'src/**/*.{ts,tsx}',
        'src/components/**/*.ts',
        '!src/**/*.d.ts',
      ],
    },
  },
})
```

### Exclude Files

```typescript
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/test/**',
        'src/**/__mocks__/**',
        'src/**/index.ts',
        'node_modules/',
        'dist/',
        'coverage/',
      ],
    },
  },
})
```

### Default Exclusions

```typescript
import { configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        ...configDefaults.coverage.exclude,  // Keep defaults
        'src/**/*.d.ts',
        'src/**/types.ts',
      ],
    },
  },
})
```

### Glob Patterns

```typescript
export default defineConfig({
  test: {
    coverage: {
      include: [
        'src/**',                    // All files in src
        'lib/**/*.ts',               // TypeScript in lib
        '!**/*.test.{ts,tsx}',       // Exclude test files
        '!**/*.spec.{ts,tsx}',       // Exclude spec files
        '!**/*.stories.{ts,tsx}',    // Exclude Storybook
        '!**/test/**',               // Exclude test directories
        '!**/__tests__/**',          // Exclude __tests__ directories
      ],
    },
  },
})
```

---

## Ignoring Code

### Line-Level Ignore

```typescript
/* v8 ignore next */
const rarelyUsedCode = () => {
  // This line is excluded from coverage
}

/* v8 ignore next 3 */
function complexFunction() {
  // This block is excluded
  // from coverage
}
```

### Preserving Comments in TypeScript

```typescript
// TypeScript strips comments during transpilation
// Add @preserve to keep the ignore directive

/* v8 ignore next -- @preserve */
const debugCode = () => {
  console.log('debug only')
}
```

### Istanbul Ignore

```typescript
/* istanbul ignore next */
const debugOnly = () => {}

/* istanbul ignore file */
// This entire file is excluded
```

### Function-Level Ignore

```typescript
/* v8 ignore start */
function legacyFunction() {
  // Legacy code excluded from coverage
}
/* v8 ignore stop */
```

### Conditional Coverage Exclusion

```typescript
function processNode(node: Node) {
  if (node.type === 'special') {
    /* v8 ignore next -- @preserve */
    return handleSpecialNode(node)  // Rarely executed
  }
  return handleNormalNode(node)
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/coverage.yml
name: Code Coverage
on: [push, pull_request]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx vitest run --coverage

      # Upload coverage to service
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false
```

### Coverage with Branch Detection

```yaml
# Only run coverage on main branch
- name: Coverage Report
  if: github.ref == 'refs/heads/main'
  run: npx vitest run --coverage

- name: Coverage Check
  if: github.ref != 'refs/heads/main'
  run: npx vitest run --coverage --coverage.thresholds.lines=80
```

### Multi-Project Coverage

```yaml
# Combine coverage from multiple projects
steps:
  - name: Frontend Coverage
    run: cd frontend && npx vitest run --coverage

  - name: Backend Coverage
    run: cd backend && npx vitest run --coverage

  - name: Merge Coverage
    run: npx istanbul-merge --out merged/lcov.info \
      frontend/coverage/lcov.info \
      backend/coverage/lcov.info
```

### Coverage Upload Services

```yaml
# Codecov
- uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    flags: unittests
    name: codecov-umbrella

# Coveralls
- uses: coverallsapp/github-action@v2
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    path-to-lcov: ./coverage/lcov.info
```

---

## Coverage Metrics

### Lines Coverage

- Percentage of executable lines executed
- Not counted: comments, blank lines, declarations
- Example: `100/150 lines = 66.7%`

```typescript
// Lines tracked:
function calculate(x: number): number {  // Line 1
  if (x > 0) {                          // Line 2
    return x * 2                         // Line 3
  }                                      // Line 4
  return 0                               // Line 5
}                                        // Line 6

// If only x > 0 path runs:
// Lines covered: 1, 2, 3, 4, 6 = 5/6 = 83.3%
```

### Branches Coverage

- Percentage of if/else/switch branches executed
- Ternary operators count as branches
- Logical operators (&&, ||) count as branches

```typescript
// Branches tracked:
const value = x > 0 ? 'positive' : 'non-positive'  // 1 branch
if (a && b) { ... }  // 2 branches (a, b)
switch (type) {
  case 'a': ...   // Branch 1
  case 'b': ...   // Branch 2
  default: ...    // Branch 3
}
```

### Functions Coverage

- Percentage of declared functions called
- Arrow functions, methods, callbacks all count

```typescript
// Functions tracked:
const add = (a, b) => a + b          // Function 1
function multiply(a, b) { return a * b }  // Function 2
const obj = { method() { return 1 } }     // Function 3

// If only add is called:
// Functions covered: 1/3 = 33.3%
```

### Statements Coverage

- Percentage of statements executed
- Similar to line coverage but at statement level

```typescript
// Statements tracked:
let x = 1           // Statement 1
x = x + 1           // Statement 2
if (x > 1) {        // Statement 3
  x = 0             // Statement 4
}
return x            // Statement 5
```

---

## Best Practices

### 1. Don't Chase 100% Coverage

```typescript
// Bad: Testing trivial code for coverage
test('returns undefined for empty input', () => {
  expect(noop()).toBeUndefined())
})

// Good: Focus on meaningful coverage
test('processes valid data correctly', () => {
  const result = processData(validInput)
  expect(result).toEqual(expectedOutput)
})
```

### 2. Test Behavior, Not Implementation

```typescript
// Bad: Testing implementation details for coverage
test('calls internal method', () => {
  const spy = vi.spyOn(service, '_internalMethod')
  service.publicMethod()
  expect(spy).toHaveBeenCalled()
})

// Good: Testing observable behavior
test('processes data correctly', () => {
  const result = service.publicMethod(inputData)
  expect(result).toEqual(expectedOutput)
})
```

### 3. Use Thresholds to Prevent Regression

```typescript
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
})
```

### 4. Exclude Test Files and Mocks

```typescript
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__mocks__/**',
        '**/test/**',
        '**/tests/**',
      ],
    },
  },
})
```

### 5. Focus Coverage on Critical Code

```typescript
// Higher coverage for core logic
'src/core/**': {
  lines: 95,
  functions: 95,
  branches: 90,
  statements: 95,
},

// Lower coverage for UI/components
'src/components/**': {
  lines: 70,
  functions: 60,
  branches: 60,
  statements: 70,
},
```

### 6. Ignore Non-Executable Code

```typescript
// Ignore type definitions
'**/*.d.ts'

// Ignore constants
'**/constants/**'

// Ignore config files
'**/*.config.{ts,js}'
```

### 7. Review Coverage Reports

```bash
# Generate and review HTML report
npx vitest run --coverage --coverage.reporter=html
open coverage/index.html

# Check specific file coverage
npx vitest run --coverage --coverage.reporter=json
cat coverage/coverage-final.json | jq '.["src/utils.ts"]'
```

### 8. Use Coverage with CI Quality Gates

```yaml
# Fail CI if coverage drops
- name: Coverage Check
  run: |
    npx vitest run --coverage
    # Coverage thresholds in config will fail if not met
```

---

## Common Patterns

### Coverage for React Components

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      include: [
        'src/components/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.stories.{ts,tsx}',
        '**/*.test.{ts,tsx}',
        '**/index.{ts,tsx}',
      ],
    },
  },
})
```

### Coverage for API Routes

```typescript
export default defineConfig({
  test: {
    coverage: {
      include: [
        'src/api/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
        'src/middleware/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        'src/api/types/**',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
})
```

### Coverage Diff in PRs

```bash
# Generate coverage diff
npx vitest run --coverage --coverage.reporter=json

# Compare with main branch
# Use coverage diff tools or custom scripts
```

### SonarQube Integration

```typescript
export default defineConfig({
  test: {
    coverage: {
      reporter: ['lcov', 'json'],
      reportsDirectory: './coverage',
    },
  },
})

// sonar-project.properties
// sonar.javascript.lcov.reportPaths=coverage/lcov.info
```

### Storybook Coverage

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      include: ['src/components/**'],
      exclude: [
        '**/*.stories.{ts,tsx}',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
    },
  },
})
```

### E2E Coverage Integration

```typescript
// For Playwright coverage (V8 coverage)
// playwright.config.ts
export default defineConfig({
  use: {
    launchOptions: {
      args: [
        '--remote-debugging-port=9222',
      ],
    },
  },
})

// Collect V8 coverage during tests
test('collect coverage', async ({ page }) => {
  const client = await page.context().newCDPSession(page)
  await client.send('Profiler.enable')
  await client.send('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  })

  // ... run test interactions ...

  const { result } = await client.send('Profiler.takePreciseCoverage')
  // Save coverage data
  await fs.writeFile('coverage/e2e-coverage.json', JSON.stringify(result))
})
```
