#!/bin/bash
# =============================================================================
# FYK Audit System — Configuration
# =============================================================================

# Paths
FYK_ROOT="/Users/cb/fyk-consolidated"
SUNBIRD_ROOT="/Users/cb/Downloads/sunbird"
AUDIT_DIR="$FYK_ROOT/agent/audit-system"
LOG_DIR="$AUDIT_DIR/logs"
PROMPT_DIR="$AUDIT_DIR/arena-prompts"
REPORT_DIR="$AUDIT_DIR/reports"

# Thresholds
MAX_TS_ERRORS=0
MAX_LINT_WARNINGS=50
MIN_TEST_COVERAGE=80
MAX_BUNDLE_SIZE_MB=5
MAX_BUILD_TIME_SEC=120
MIN_AUDIT_SCORE=85

# Arena.ai endpoints
ARENA_FYK_AGENT="https://arena.ai/agent/01a09011-643e-7bd6-bebf-281a38ff4638"
ARENA_SUNBIRD_AGENT="https://arena.ai/agent/01a09023-db99-7a6f-a971-951b2ad60295"

# Timing
AUDIT_INTERVAL_MIN=10
SUNBIRD_CHECK_INTERVAL_MIN=15

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Ensure directories exist
mkdir -p "$LOG_DIR" "$PROMPT_DIR" "$REPORT_DIR"
