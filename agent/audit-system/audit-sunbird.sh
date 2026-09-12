#!/bin/bash
# =============================================================================
# Sunbird Repo — Audit Script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/config.sh"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  SUNBIRD — REPO AUDIT${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"

# Check if sunbird exists locally
if [[ ! -d "$SUNBIRD_ROOT" ]]; then
    echo -e "${YELLOW}Cloning sunbird repo...${NC}"
    git clone https://github.com/CerisonAutomation/sunbird.git "$SUNBIRD_ROOT" 2>&1 || {
        echo -e "${RED}Failed to clone sunbird${NC}"
        exit 1
    }
fi

cd "$SUNBIRD_ROOT"

# Pull latest
echo -e "${YELLOW}Pulling latest changes...${NC}"
git pull 2>&1 || true

# Install deps
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install 2>&1 | tail -5 || true

# TypeScript check
echo -e "\n${YELLOW}▶ TypeScript Check${NC}"
if npx tsc --noEmit 2>&1; then
    echo -e "  ${GREEN}✓ TypeScript OK${NC}"
else
    echo -e "  ${RED}✗ TypeScript errors${NC}"
fi

# Build
echo -e "\n${YELLOW}▶ Build Check${NC}"
BUILD_START=$(date +%s)
if npm run build 2>&1 | tail -5; then
    BUILD_END=$(date +%s)
    echo -e "  ${GREEN}✓ Build OK${NC} (${BUILD_END - BUILD_START}s)"
else
    echo -e "  ${RED}✗ Build failed${NC}"
fi

# Test
echo -e "\n${YELLOW}▶ Test Check${NC}"
if npm test 2>&1 | tail -10; then
    echo -e "  ${GREEN}✓ Tests OK${NC}"
else
    echo -e "  ${YELLOW}⚠ Tests failed or missing${NC}"
fi

# Bundle size
echo -e "\n${YELLOW}▶ Bundle Size${NC}"
if [[ -d "dist" ]]; then
    du -sh dist/
fi

echo -e "\n${GREEN}Sunbird audit complete${NC}"
cd "$FYK_ROOT"
