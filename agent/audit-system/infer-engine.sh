#!/bin/bash
# =============================================================================
# FYK Infer Engine — Reads audit results, generates arena.ai prompts
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/config.sh"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROMPT_FILE="$PROMPT_DIR/arena-prompt-$TIMESTAMP.md"

# Find latest audit report
LATEST_REPORT=$(ls -t "$LOG_DIR"/fyk-audit-*.json 2>/dev/null | head -1)

if [[ -z "$LATEST_REPORT" ]]; then
    echo -e "${RED}No audit report found. Run audit first.${NC}"
    exit 1
fi

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  INFER ENGINE — ANALYZING AUDIT RESULTS${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  Report: $LATEST_REPORT"
echo ""

# Parse the JSON report
SCORE=$(python3 -c "import json; d=json.load(open('$LATEST_REPORT')); print(d['score'])")
PASS=$(python3 -c "import json; d=json.load(open('$LATEST_REPORT')); print(d['pass'])")
FAIL=$(python3 -c "import json; d=json.load(open('$LATEST_REPORT')); print(d['fail'])")
WARN=$(python3 -c "import json; d=json.load(open('$LATEST_REPORT')); print(d['warn'])")

# Extract failing checks
FAILING_CHECKS=$(python3 -c "
import json
d = json.load(open('$LATEST_REPORT'))
for k, v in d['checks'].items():
    if v['status'] == 'FAIL':
        t = v.get('threshold', 'N/A')
        print(f\"- {k}: {v['value']} (threshold: {t})\")
")

# Extract warnings
WARNING_CHECKS=$(python3 -c "
import json
d = json.load(open('$LATEST_REPORT'))
for k, v in d['checks'].items():
    if v['status'] == 'WARN':
        print(f\"- {k}: {v['value']}\")
")

# Determine priority actions
echo -e "${BOLD}${BLUE}━━━ PRIORITY ANALYSIS ━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Generate arena.ai prompt based on findings
cat > "$PROMPT_FILE" << 'HEADER'
# FYK Consolidated — Expert Audit Prompt

You are an elite full-stack production engineer auditing the FYK Consolidated platform.
This is a dating/social platform built with React + Vite + TanStack Router + Supabase + Prisma.

## Your Role
Analyze the audit results below and provide:
1. **Critical Fixes** — Issues that MUST be resolved before production
2. **Architecture Review** — Structural improvements for scalability
3. **Performance Optimizations** — Speed and efficiency gains
4. **Security Hardening** — Vulnerability fixes and best practices
5. **Testing Strategy** — What tests to add and how
6. **Code Quality** — Refactoring opportunities

## Audit Score: $SCORE/100
## Pass: $PASS | Fail: $FAIL | Warn: $WARN

HEADER

echo "## Failing Checks" >> "$PROMPT_FILE"
echo "$FAILING_CHECKS" >> "$PROMPT_FILE"
echo "" >> "$PROMPT_FILE"

echo "## Warnings" >> "$PROMPT_FILE"
if [[ -n "$WARNING_CHECKS" ]]; then
    echo "$WARNING_CHECKS" >> "$PROMPT_FILE"
else
    echo "- None" >> "$PROMPT_FILE"
fi
echo "" >> "$PROMPT_FILE"

# Add project context
cat >> "$PROMPT_FILE" << 'CONTEXT'
## Project Context

### Tech Stack
- **Frontend**: React 19 + Vite + TypeScript + TanStack Router
- **Styling**: Tailwind CSS v4
- **State**: TanStack Query + Zustand
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **ORM**: Prisma with PostgreSQL adapter
- **Testing**: Vitest + Playwright
- **Linting**: Biome
- **Deployment**: Vercel + Cloudflare Workers

### Key Features
- User authentication (Supabase Auth)
- Real-time messaging
- Photo sharing
- Interest matching
- Map integration (Mapbox)
- AI-powered features
- WebSocket presence

### Database Models
User, Profile, Pet, Conversation, Message, Match, Like,
Notification, Wallet, Story, Grant, Event, RSVP, Report

CONTEXT

# Generate specific prompts based on failures
echo "## Specific Analysis Requests" >> "$PROMPT_FILE"

if echo "$FAILING_CHECKS" | grep -qi "typescript"; then
    cat >> "$PROMPT_FILE" << 'TS'
### TypeScript Errors
- List every TypeScript error with file path and line number
- For each error, explain the root cause
- Provide the exact fix (code snippet)
- Group by category: type mismatch, missing imports, null safety, etc.
- Prioritize by: critical path > shared utilities > components > tests

TS
fi

if echo "$FAILING_CHECKS" | grep -qi "lint"; then
    cat >> "$PROMPT_FILE" << 'LINT'
### Lint Issues
- Categorize: error vs warning vs info
- For each warning, determine if it's a real issue or can be suppressed
- Provide auto-fixable vs manual-fix separation
- Show the biome config changes needed (if any)

LINT
fi

if echo "$FAILING_CHECKS" | grep -qi "test"; then
    cat >> "$PROMPT_FILE" << 'TEST'
### Test Failures
- For each failing test: why it fails, what the expected behavior is
- Provide the fix for each test
- Identify missing test coverage areas
- Recommend new test cases for critical paths

TEST
fi

if echo "$FAILING_CHECKS" | grep -qi "build"; then
    cat >> "$PROMPT_FILE" << 'BUILD'
### Build Issues
- Identify the build failure point
- Check for circular dependencies
- Check for missing exports
- Verify all imports resolve correctly
- Check for tree-shaking issues

BUILD
fi

if echo "$FAILING_CHECKS" | grep -qi "security"; then
    cat >> "$PROMPT_FILE" << 'SEC'
### Security Concerns
- Map each finding to OWASP Top 10
- Provide the exact code fix
- Add input validation where needed
- Check for XSS, CSRF, SQL injection vectors
- Verify auth token handling

SEC
fi

if echo "$FAILING_CHECKS" | grep -qi "prisma\|database"; then
    cat >> "$PROMPT_FILE" << 'DB'
### Database/Prisma Issues
- Verify schema matches application needs
- Check for missing indexes on query-heavy fields
- Review migration strategy
- Verify foreign key relationships
- Check for N+1 query patterns

DB
fi

# Add the action plan section
cat >> "$PROMPT_FILE" << 'ACTION'
## Deliverables

Please provide:

1. **Immediate Fixes** (do these first)
   - Code changes with file paths
   - Command to run to verify

2. **Architecture Improvements** (do these next)
   - Refactoring plan
   - File organization changes

3. **Testing Gaps** (fill these)
   - Unit tests needed
   - Integration tests needed
   - E2E test scenarios

4. **Performance Wins** (low-hanging fruit)
   - Bundle size reductions
   - Render optimizations
   - Query optimizations

5. **Security Hardening** (must-do)
   - Input validation
   - Auth improvements
   - Data protection

For each item, provide:
- Priority: P0 (critical), P1 (high), P2 (medium), P3 (nice-to-have)
- Effort: S (minutes), M (hours), L (days)
- Impact: What improves
- Risk: What could break

ACTION

echo -e "${GREEN}✓ Arena.ai prompt generated: $PROMPT_FILE${NC}"
echo ""

# Now generate the sunbird prompt
SUNBIRD_PROMPT="$PROMPT_DIR/sunbird-prompt-$TIMESTAMP.md"

cat > "$SUNBIRD_PROMPT" << 'SUNBIRD'
# Sunbird Game — Expert Audit Prompt

You are an elite game engineer auditing the Sunbird browser game.
This is a Three.js + React + Vite arcade game deployed on Vercel + Cloudflare Workers.

## Your Role
Analyze the codebase and provide:
1. **Performance Audit** — Frame rate, memory, bundle size
2. **Game Loop Optimization** — Physics, rendering, input handling
3. **Multiplayer Stability** — WebSocket, Durable Objects, conflict resolution
4. **Asset Optimization** — Textures, models, audio compression
5. **Cross-Platform** — Mobile, desktop, different GPUs
6. **Monetization** — Stripe integration, ad placement, conversion

## Tech Stack
- Three.js (WebGL rendering)
- React + Vite + TypeScript
- Tailwind CSS
- Cloudflare Workers + Durable Objects
- Stripe (payments)
- Vercel (frontend deployment)

## Deliverables
For each finding:
- What: The issue
- Why: Impact on users
- How: Exact fix with code
- Priority: P0-P3
- Effort: S/M/L

SUNBIRD

echo -e "${GREEN}✓ Sunbird prompt generated: $SUNBIRD_PROMPT${NC}"

# Summary
echo -e "\n${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  INFER ENGINE COMPLETE${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "\n  Generated prompts:"
echo -e "    FYK:     $PROMPT_FILE"
echo -e "    Sunbird: $SUNBIRD_PROMPT"
echo -e "\n  ${BOLD}Next steps:${NC}"
echo -e "    1. Copy the prompt content to arena.ai"
echo -e "    2. Share with the expert agents"
echo -e "    3. Apply the recommended fixes"
echo -e "    4. Re-run audit to verify improvements"
