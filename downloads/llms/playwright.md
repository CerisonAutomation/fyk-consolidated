# Playwright E2E Testing Patterns & Best Practices

## Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [Locator Strategies](#locator-strategies)
3. [Assertions](#assertions)
4. [Page Objects & Helpers](#page-objects--helpers)
5. [Network Mocking](#network-mocking)
6. [Authentication](#authentication)
7. [Visual Testing](#visual-testing)
8. [Test Isolation](#test-isolation)
9. [Parallelism & Sharding](#parallelism--sharding)
10. [Debugging](#debugging)
11. [CI/CD Integration](#cicd-integration)
12. [Advanced Patterns](#advanced-patterns)

---

## Setup & Configuration

### Installation

```bash
npm init playwright@latest
# or
npm install -D @playwright/test
npx playwright install
```

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,             // Run all tests in parallel
  forbidOnly: !!process.env.CI,    // Fail on .only in CI
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    process.env.CI ? 'github' : 'list',
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',       // Record trace on first retry
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

### Environment Variables

```bash
# .env.test
BASE_URL=http://localhost:3000
API_KEY=test-key-12345

# In config
export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
})
```

---

## Locator Strategies

### Priority Order (from best to worst)

```typescript
// 1. Role + accessible name (best)
page.getByRole('button', { name: 'Submit' })
page.getByRole('heading', { name: 'Welcome' })
page.getByRole('link', { name: 'About' })
page.getByRole('checkbox', { name: 'Accept terms' })

// 2. Label text (form fields)
page.getByLabel('Email address')
page.getByLabel('Password')

// 3. Placeholder text (fallback)
page.getByPlaceholder('Search...')

// 4. Text content (non-interactive)
page.getByText('Welcome back')
page.getByText('Error occurred', { exact: false })

// 5. Display value (form inputs)
page.getByDisplayValue('john@example.com')

// 6. Alt text (images)
page.getByAltText('Company logo')

// 7. Title attribute
page.getByTitle('Close dialog')

// 8. Test ID (escape hatch only)
page.getByTestId('submit-button')
```

### Chaining & Filtering

```typescript
// Chain within container
const form = page.getByRole('form', { name: 'Login' })
const emailInput = form.getByLabel('Email')
const submitButton = form.getByRole('button', { name: 'Sign in' })

// Filter by text
const product = page.getByRole('listitem')
  .filter({ hasText: 'Product 2' })
  .getByRole('button', { name: 'Add to cart' })

// Multiple filters
const items = page.getByRole('listitem')
  .filter({ hasText: 'Active' })
  .filter({ hasText: 'Important' })

// Locator with state
const enabledSubmit = page.getByRole('button', { name: 'Submit' })
  .filter({ hasNot: page.locator('[disabled]') })
```

### Dynamic Content Locators

```typescript
// Wait for text to appear
await expect(page.getByText('Loading complete')).toBeVisible()

// Regex matching
await expect(page.getByText(/error \d{3}/)).toBeVisible()

// Nth element
const secondItem = page.getByRole('listitem').nth(1)

// First and last
const firstItem = page.getByRole('listitem').first()
const lastItem = page.getByRole('listitem').last()

// Count elements
await expect(page.getByRole('listitem')).toHaveCount(5)

// Locator inside iframe
const frame = page.frameLocator('iframe[name="editor"]')
await frame.getByRole('button', { name: 'Save' }).click()
```

---

## Assertions

### Auto-Retry Assertions (Preferred)

```typescript
// These auto-retry until timeout
await expect(page.getByText('Welcome')).toBeVisible()
await expect(page.getByText('Welcome')).toBeHidden()
await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled()
await expect(page.getByRole('button', { name: 'Submit' })).toBeDisabled()
await expect(page.getByTestId('status')).toHaveText('Complete')
await expect(page.getByTestId('price')).toContainText('$29.99')
await expect(page.locator('.spinner')).toHaveCount(0)
await expect(page.locator('input')).toHaveValue('test@email.com')
await expect(page.locator('.error')).toHaveClass(/error-message/)
await expect(page.getByTestId('link')).toHaveAttribute('href', '/dashboard')
await expect(page.getByRole('checkbox')).toBeChecked()
await expect(page.getByRole('checkbox')).not.toBeChecked()
await expect(page.locator('.btn')).toHaveCSS('color', 'rgb(255, 0, 0)')
await expect(page.locator('.content')).toHaveText(
  /Welcome.*User/
)
```

### Soft Assertions

```typescript
// Continue test even if assertion fails
await expect.soft(page.getByTestId('name')).toHaveText('John')
await expect.soft(page.getByTestId('email')).toHaveText('john@test.com')
await expect.soft(page.getByTestId('role')).toHaveText('Admin')
// Test continues and reports all failures at the end
```

### Custom Expect Configuration

```typescript
// Slow assertions for flaky elements
const slowExpect = expect.configure({ timeout: 10000 })
await slowExpect(page.getByTestId('chart')).toBeVisible()

// Poll for async conditions
await expect.poll(async () => {
  const response = await page.request.get('/api/status')
  return response.status()
}).toBe(200)

// Retry code block
await expect(async () => {
  const response = await page.request.get('/api/health')
  expect(response.status()).toBe(200)
}).toPass({ timeout: 30_000 })
```

### Custom Assertions

```typescript
import { test as base, expect } from '@playwright/test'

const test = base.extend({
  // Custom assertion: check element has specific data attribute
})

export const expect = baseExpect.extend({
  async toHaveAmount(locator: Locator, expected: number) {
    const assertionName = 'toHaveAmount'
    let pass: boolean
    let diff: string | undefined

    try {
      await expect(locator).toHaveAttribute('data-amount', String(expected))
      pass = true
    } catch (e) {
      pass = false
      diff = `Expected ${await locator.getAttribute('data-amount')} to be ${expected}`
    }

    return {
      pass,
      name: assertionName,
      message: () => diff || '',
    }
  },
})
```

---

## Page Objects & Helpers

### Page Object Pattern

```typescript
// pages/LoginPage.ts
import { type Page, type Locator } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.getByLabel('Email')
    this.passwordInput = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Sign in' })
    this.errorMessage = page.getByTestId('error-message')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async getError(): Promise<string | null> {
    const error = this.errorMessage
    if (await error.isVisible()) {
      return error.textContent()
    }
    return null
  }
}
```

### Usage in Tests

```typescript
import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'

test('login with valid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page)
  await loginPage.goto()
  await loginPage.login('user@test.com', 'password123')
  await expect(page).toHaveURL('/dashboard')
})

test('login with invalid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page)
  await loginPage.goto()
  await loginPage.login('wrong@test.com', 'badpassword')
  const error = await loginPage.getError()
  expect(error).toContain('Invalid credentials')
})
```

### Component Helper Pattern

```typescript
// helpers/components/Dropdown.ts
import { type Page, type Locator } from '@playwright/test'

export class Dropdown {
  constructor(
    private page: Page,
    private selector: string,
  ) {}

  get trigger() {
    return this.page.locator(this.selector).getByRole('button')
  }

  option(text: string) {
    return this.page.getByRole('option', { name: text })
  }

  async select(text: string) {
    await this.trigger.click()
    await this.option(text).click()
  }

  async getSelectedText(): Promise<string | null> {
    return this.trigger.textContent()
  }
}

// Usage
const countryDropdown = new Dropdown(page, '[data-testid="country"]')
await countryDropdown.select('Canada')
expect(await countryDropdown.getSelectedText()).toBe('Canada')
```

---

## Network Mocking

### Route Interception

```typescript
test('mock API response', async ({ page }) => {
  // Mock specific API endpoint
  await page.route('**/api/users', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ]),
    })
  )

  await page.goto('/users')
  await expect(page.getByText('John')).toBeVisible()
})
```

### Conditional Mocking

```typescript
test('mock only POST requests', async ({ page }) => {
  await page.route('**/api/data', (route, request) => {
    if (request.method() === 'POST') {
      route.fulfill({
        status: 201,
        body: JSON.stringify({ success: true }),
      })
    } else {
      route.continue()  // Pass through GET requests
    }
  })
})
```

### Error Simulation

```typescript
test('handle network error', async ({ page }) => {
  await page.route('**/api/data', route =>
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    })
  )

  await page.goto('/dashboard')
  await expect(page.getByText('Something went wrong')).toBeVisible()
})

test('handle timeout', async ({ page }) => {
  await page.route('**/api/slow', route =>
    route.abort('timedout')
  )
})
```

### Mock with Actual Response

```typescript
test('modify real response', async ({ page }) => {
  await page.route('**/api/products', async (route) => {
    const response = await route.fetch()
    const body = await response?.json()

    // Add a test product to real data
    body.push({ id: 999, name: 'Test Product', price: 0 })

    await route.fulfill({
      response,
      body: JSON.stringify(body),
    })
  })
})
```

---

## Authentication

### Global Auth Setup

```typescript
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test'

const authFile = 'tests/.auth/user.json'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!)
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dashboard')

  // Save authentication state
  await page.context().storageState({ path: authFile })
})

// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'e2e',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
})
```

### Per-Test Authentication

```typescript
test('login and access dashboard', async ({ page }) => {
  // Mock auth endpoint
  await page.route('**/api/auth/login', route =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ token: 'fake-token' }),
    })
  )

  await page.goto('/login')
  await page.getByLabel('Email').fill('test@test.com')
  await page.getByLabel('Password').fill('password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dashboard')
})
```

---

## Visual Testing

### Screenshots

```typescript
test('full page screenshot', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveScreenshot('dashboard.png', {
    fullPage: true,
  })
})

test('element screenshot', async ({ page }) => {
  const card = page.locator('.product-card').first()
  await expect(card).toHaveScreenshot('product-card.png')
})

// Visual comparison with mask
test('masked screenshot', async ({ page }) => {
  await expect(page).toHaveScreenshot('page.png', {
    mask: [
      page.locator('.timestamp'),
      page.locator('.avatar'),
    ],
    maxDiffPixelRatio: 0.01,
  })
})
```

### Visual Regression Config

```typescript
// playwright.config.ts
export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
})
```

---

## Test Isolation

### Storage State Isolation

```typescript
test.describe('with clean state', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies and storage
    await page.context().clearCookies()
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })
})
```

### Database Reset

```typescript
test.describe.serial('ordered tests', () => {
  test('create item', async ({ page }) => {
    await page.goto('/items/new')
    await page.getByLabel('Name').fill('Test Item')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Item created')).toBeVisible()
  })

  test('edit item', async ({ page }) => {
    // Depends on create test running first
    await page.goto('/items')
    await page.getByText('Test Item').click()
    await page.getByLabel('Name').fill('Updated Item')
    await page.getByRole('button', { name: 'Save' }).click()
  })
})
```

---

## Parallelism & Sharding

### Parallel Execution

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,     // Default: true
  workers: process.env.CI ? 1 : undefined,
})

// In-file parallel
test.describe.configure({ mode: 'parallel' })
```

### CI Sharding

```bash
# Distribute tests across CI machines
npx playwright test --shard=1/3   # Machine 1
npx playwright test --shard=2/3   # Machine 2
npx playwright test --shard=3/3   # Machine 3

# GitHub Actions example
# jobs:
#   test:
#     strategy:
#       matrix:
#         shard: [1, 2, 3, 4]
#     steps:
#       - run: npx playwright test --shard=${{ matrix.shard }}/4
```

---

## Debugging

### VS Code Extension

```bash
# Install Playwright Test extension for VS Code
# Features:
# - Run/debug tests from sidebar
# - Live locator preview
# - Code generation
# - Trace viewer integration
```

### Playwright Inspector

```bash
# Debug mode with inspector
npx playwright test --debug

# Debug specific test
npx playwright test --debug tests/login.spec.ts
```

### Trace Viewer

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    trace: 'on-first-retry',  // Record trace on first retry
  },
})

// View trace
npx playwright show-trace trace.zip
```

### Console Logging

```typescript
test('debug test', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()))
  page.on('pageerror', err => console.log('PAGE ERROR:', err))

  await page.goto('/dashboard')
  // ... test logic
})
```

### Codegen

```bash
# Generate test code by recording interactions
npx playwright codegen https://example.com

# Record and generate test with specific browser
npx playwright codegen --browser chromium https://example.com

# Generate with specific device
npx playwright codegen --device "iPhone 13" https://example.com
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --project=chromium
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### Parallel CI

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4]

steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
  - uses: actions/upload-artifact@v4
    with:
      name: report-${{ matrix.shard }}
      path: playwright-report/
```

---

## Advanced Patterns

### Request Context (API Testing)

```typescript
test('API + UI integration', async ({ page, request }) => {
  // Create data via API
  await request.post('/api/users', {
    data: { name: 'API User', email: 'api@test.com' },
  })

  // Verify in UI
  await page.goto('/users')
  await expect(page.getByText('API User')).toBeVisible()
})
```

### Multi-Tab Testing

```typescript
test('multi-tab workflow', async ({ context }) => {
  const page1 = await context.newPage()
  const page2 = await context.newPage()

  await page1.goto('/dashboard')
  await page2.goto('/admin')

  // Verify both tabs can see real-time updates
  await page1.getByRole('button', { name: 'Post update' }).click()
  await expect(page2.getByText('New update')).toBeVisible()
})
```

### Mobile Testing

```typescript
test('mobile navigation', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    geolocation: { latitude: 40.7128, longitude: -74.0060 },
    permissions: ['geolocation'],
  })
  const page = await context.newPage()

  await page.goto('/')
  await expect(page.getByRole('navigation')).toBeVisible()

  await context.close()
})
```

### File Upload/Download

```typescript
test('file upload', async ({ page }) => {
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Upload file' }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles('tests/fixtures/test-file.pdf')
  await expect(page.getByText('File uploaded')).toBeVisible()
})

test('file download', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download report' }).click()
  const download = await downloadPromise
  await download.saveAs('downloads/report.pdf')
})
```
