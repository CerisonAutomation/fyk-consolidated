---
active: true
iteration: 0
max_iterations: 20
completion_promise: null
---

# Fix All Remaining TypeScript Errors

## Objective
Fix all 140 remaining TypeScript errors in the codebase to achieve a clean build.

## Completion Criteria
Complete when `npx tsc --noEmit 2>&1 | grep -c "error TS"` returns 0

## Verification Commands
- `npx tsc --noEmit 2>&1 | grep -E "error TS" | wc -l`

## Context
- Read the error list from `npx tsc --noEmit 2>&1 | grep "error TS"`
- Follow existing code patterns in the project
- The project uses Supabase, Prisma, TanStack Router, Zustand

## Instructions
1. Check TODO.md for current task list
2. Run `npx tsc --noEmit 2>&1 | grep "error TS"` to see current errors
3. Fix errors by category (TS2339, TS18048, TS2322, etc.)
4. Run verification after each batch of fixes
5. Mark [x] ALL_TASKS_COMPLETE when done
