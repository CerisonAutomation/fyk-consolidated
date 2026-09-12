# Arena.ai Prompt #4: Code Quality Audit

Paste this into arena.ai agent for independent code quality assessment.

---

## System Under Review

Code quality audit for "FYK" — a TanStack Start dating platform at https://github.com/CerisonAutomation/fyk-consolidated.

### Quality Tools Configured
- Biome 2.4.5 (formatting + linting, scoped to src/**)
- TypeScript 6.0 with strict mode (noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch)
- Vitest with 70% coverage threshold on domains/core
- Fallow found 945 dead-code issues (pre-existing)

### Known Quality Issues
- 945 dead code issues from fallow analysis
- @faker-js/faker in production dependencies
- Dual path aliases (#/* and @/*) — confusing
- next.config.ts is dead code (excluded from tsconfig)
- package-lock.json alongside pnpm-lock.yaml (tooling confusion)
- No pre-commit hooks to enforce quality gates

## Your Task

Assess code quality across all dimensions. Rate each finding and provide fixes.

### 1. Code Smells
- God objects/classes (files >500 lines)
- Long parameter lists (>4 params)
- Deep nesting (>3 levels)
- Magic numbers/strings
- Commented-out code blocks
- Duplicate code patterns

### 2. Error Handling
- Consistent error types across domains
- Proper error boundaries in React
- API error response format consistency
- Graceful degradation patterns
- Retry logic for network requests

### 3. Type Safety
- TypeScript strict mode compliance
- Any usage of `any` type
- Proper generic constraints
- Zod schema ↔ TypeScript type alignment
- Runtime validation at API boundaries

### 4. Testing Quality
- Test coverage gaps (9 tests for 60 models)
- Missing test categories (integration, contract, visual)
- Test isolation (proper mocking, no shared state)
- Edge case coverage
- Performance test considerations

### 5. Documentation
- API documentation completeness
- Component prop documentation
- Domain logic documentation
- Deployment runbook
- Incident response procedures

### 6. Dependency Health
- Unused dependencies (fallow found 72, already removed)
- Outdated dependencies
- License compatibility
- Security vulnerability scan
- Bundle size impact per dependency

## Deliverable

```
## Code Quality Audit: FYK

### Critical Quality Issues (fix immediately)
1. [Issue] — [Category] — [Impact] — [Fix]

### Code Smells (fix in sprint 1)
1. [Smell] — [Location] — [Refactoring Strategy]

### Test Coverage Gaps
| Domain | Current | Target | Priority |
|--------|---------|--------|----------|
| auth | X% | 80% | Critical |
| chat | X% | 80% | Critical |
| grid | X% | 80% | High |
| ... | | | |

### Documentation Gaps
1. [Missing Doc] — [Audience] — [Priority]

### Quality Score: X/10
### Technical Debt Estimate: X hours
### Recommended Refactoring Order: [prioritized list]
```
