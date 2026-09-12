#!/bin/bash
# =============================================================================
# FYK Audit Dashboard — Live Progress Tracker
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/config.sh"

clear

echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  FYK PROD-READINESS DASHBOARD                    ║${NC}"
echo -e "${BOLD}${CYAN}║  $(date +"%Y-%m-%d %H:%M:%S")                          ║${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════╝${NC}"

# Latest scores
echo -e "\n${BOLD}${BLUE}━━━ LATEST SCORES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

LATEST_FYK=$(ls -t "$LOG_DIR"/fyk-audit-*.json 2>/dev/null | head -1)
if [[ -n "$LATEST_FYK" ]]; then
    SCORE=$(python3 -c "import json; d=json.load(open('$LATEST_FYK')); print(d['score'])")
    PASS=$(python3 -c "import json; d=json.load(open('$LATEST_FYK')); print(d['pass'])")
    FAIL=$(python3 -c "import json; d=json.load(open('$LATEST_FYK')); print(d['fail'])")
    WARN=$(python3 -c "import json; d=json.load(open('$LATEST_FYK')); print(d['warn'])")
    TIMESTAMP=$(python3 -c "import json; d=json.load(open('$LATEST_FYK')); print(d['timestamp'])")

    echo -e "  ${BOLD}FYK Score:${NC}   $SCORE/100"
    echo -e "  ${GREEN}Pass:${NC}       $PASS"
    echo -e "  ${RED}Fail:${NC}       $FAIL"
    echo -e "  ${YELLOW}Warn:${NC}       $WARN"
    echo -e "  ${BOLD}Last Run:${NC}   $TIMESTAMP"

    # Visual bar
    BAR_LEN=40
    FILLED=$(( SCORE * BAR_LEN / 100 ))
    EMPTY=$(( BAR_LEN - FILLED ))
    echo -e "\n  Score: [${GREEN}$(printf '█%.0s' $(seq 1 $FILLED 2>/dev/null))${NC}$(printf '░%.0s' $(seq 1 $EMPTY 2>/dev/null))] $SCORE%"
else
    echo -e "  ${YELLOW}No audit runs yet${NC}"
fi

# Check history
echo -e "\n${BOLD}${BLUE}━━━ AUDIT HISTORY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

HISTORY_COUNT=$(ls "$LOG_DIR"/fyk-audit-*.json 2>/dev/null | wc -l | tr -d ' ')
echo -e "  Total runs: $HISTORY_COUNT"

if [[ "$HISTORY_COUNT" -gt 1 ]]; then
    echo -e "\n  ${BOLD}Recent scores:${NC}"
    ls -t "$LOG_DIR"/fyk-audit-*.json 2>/dev/null | head -5 | while read f; do
        TS=$(python3 -c "import json; d=json.load(open('$f')); print(d['timestamp'][:19])")
        SC=$(python3 -c "import json; d=json.load(open('$f')); print(d['score'])")
        echo -e "    $TS — $SC/100"
    done
fi

# Generated prompts
echo -e "\n${BOLD}${BLUE}━━━ GENERATED PROMPTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PROMPT_COUNT=$(ls "$PROMPT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
echo -e "  Arena.ai prompts: $PROMPT_COUNT"

if [[ "$PROMPT_COUNT" -gt 0 ]]; then
    echo -e "\n  ${BOLD}Latest prompts:${NC}"
    ls -t "$PROMPT_DIR"/*.md 2>/dev/null | head -3 | while read f; do
        NAME=$(basename "$f")
        SIZE=$(wc -c < "$f" | tr -d ' ')
        echo -e "    $NAME ($SIZE bytes)"
    done
fi

# Reports
echo -e "\n${BOLD}${BLUE}━━━ SAVED REPORTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

REPORT_COUNT=$(ls "$REPORT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
echo -e "  Reports: $REPORT_COUNT"

# Trend analysis
echo -e "\n${BOLD}${BLUE}━━━ TREND ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ "$HISTORY_COUNT" -ge 2 ]]; then
    FIRST=$(ls "$LOG_DIR"/fyk-audit-*.json | head -1)
    LAST=$(ls "$LOG_DIR"/fyk-audit-*.json | tail -1)
    FIRST_SCORE=$(python3 -c "import json; d=json.load(open('$FIRST')); print(d['score'])")
    LAST_SCORE=$(python3 -c "import json; d=json.load(open('$LAST')); print(d['score'])")

    if [[ "$LAST_SCORE" -gt "$FIRST_SCORE" ]]; then
        DIFF=$((LAST_SCORE - FIRST_SCORE))
        echo -e "  ${GREEN}↑ IMPROVING${NC} (+$DIFF points since first run)"
    elif [[ "$LAST_SCORE" -lt "$FIRST_SCORE" ]]; then
        DIFF=$((FIRST_SCORE - LAST_SCORE))
        echo -e "  ${RED}↓ DECLINING${NC} (-$DIFF points since first run)"
    else
        echo -e "  ${YELLOW}→ STABLE${NC}"
    fi
else
    echo -e "  ${YELLOW}Need 2+ runs for trend analysis${NC}"
fi

# Next actions
echo -e "\n${BOLD}${BLUE}━━━ NEXT ACTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ -n "$LATEST_FYK" ]]; then
    FAIL_CHECKS=$(python3 -c "
import json
d = json.load(open('$LATEST_FYK'))
for k, v in d['checks'].items():
    if v['status'] == 'FAIL':
        print(f'  ❌ {k}: {v[\"value\"]}')
" 2>/dev/null)

    if [[ -n "$FAIL_CHECKS" ]]; then
        echo -e "  ${BOLD}Priority fixes:${NC}"
        echo "$FAIL_CHECKS"
    else
        echo -e "  ${GREEN}✓ No critical failures${NC}"
    fi
fi

echo -e "\n${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  Run ${CYAN}./run-loop.sh${NC} to start auditing"
echo -e "  Run ${CYAN}./run-loop.sh daemon${NC} for continuous monitoring"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
