# GitHub Actions CI/CD Patterns

> Source: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions

## Workflow File Structure

Store workflows in `.github/workflows/` with `.yml` or `.yaml` extension.

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm test
```

## Trigger Patterns

### Single Event
```yaml
on: push
```

### Multiple Events
```yaml
on: [push, pull_request, fork]
```

### Activity Types
```yaml
on:
  issues:
    types: [opened, labeled]
  pull_request:
    types: [opened, synchronize, reopened]
```

### Branch Filters
```yaml
on:
  push:
    branches:
      - main
      - 'releases/**'
```

### Path Filters (only run when specific files change)
```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'package.json'
    paths-ignore:
      - 'docs/**'
      - '*.md'
```

## Common CI/CD Patterns

### Test and Build
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

### Deploy to Vercel on Merge
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Matrix Testing
```yaml
name: Test
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

### Caching Dependencies
```yaml
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
      cache: 'npm'
  - run: npm ci
```

### Environment Secrets
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "Deploying with ${{ secrets.DEPLOY_KEY }}"
```

### Conditional Jobs
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run deploy
```

### Reusable Workflows
```yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      deploy-token:
        required: true
```

```yaml
# Caller workflow
jobs:
  deploy:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
    secrets:
      deploy-token: ${{ secrets.DEPLOY_TOKEN }}
```

## Best Practices

1. **Pin action versions:** Use `@v4` not `@main` for stability
2. **Cache dependencies:** Use built-in cache support in `setup-node`
3. **Use environments:** Protect production deployments with approval gates
4. **Limit concurrent runs:** Prevent overlapping deployments
5. **Use matrix strategy:** Test across multiple versions simultaneously
6. **Set `permissions`:** Use least-privilege access for security
7. **Use reusable workflows:** Avoid duplicating CI/CD logic across repos

## Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Security

```yaml
permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
```
