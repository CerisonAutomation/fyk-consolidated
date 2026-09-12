#!/bin/bash
# =============================================================================
# FYK Prod-Readiness Command Center — Master Runner
# =============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/config.sh"

MODE="${1:-once}"

echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  FYK PROD-READINESS COMMAND CENTER                ║${NC}"
echo -e "${BOLD}${CYAN}║  $(date)                   ║${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════╝${NC}"

run_full_cycle() {
    local CYCLE_NUM="${1:-1}"
    local CYCLE_TIME=$(date +%Y%m%d_%H%M%S)

    echo -e "\n${BOLD}${PURPLE}═══ CYCLE $CYCLE_NUM — $CYCLE_TIME ═══${NC}\n"

    # Phase 1: FYK Audit
    echo -e "${BOLD}${BLUE}PHASE 1: FYK Consolidated Audit${NC}"
    echo "─────────────────────────────────"
    bash "$SCRIPT_DIR/audit-fyk.sh" 2>&1 | tee "$LOG_DIR/cycle-$CYCLE_TIME-fyk.log" || echo -e "  ${YELLOW}⚠ Phase 1 had errors (continuing)${NC}"

    # Phase 2: Infer Engine
    echo -e "\n${BOLD}${BLUE}PHASE 2: Infer Engine Analysis${NC}"
    echo "─────────────────────────────────"
    bash "$SCRIPT_DIR/infer-engine.sh" 2>&1 | tee "$LOG_DIR/cycle-$CYCLE_TIME-infer.log" || echo -e "  ${YELLOW}⚠ Phase 2 had errors (continuing)${NC}"

    # Phase 3: Sunbird Check (every other cycle)
    if [[ $((CYCLE_NUM % 2)) -eq 0 ]]; then
        echo -e "\n${BOLD}${BLUE}PHASE 3: Sunbird Repo Check${NC}"
        echo "─────────────────────────────────"
        bash "$SCRIPT_DIR/audit-sunbird.sh" 2>&1 | tee "$LOG_DIR/cycle-$CYCLE_TIME-sunbird.log" || echo -e "  ${YELLOW}⚠ Phase 3 had errors (continuing)${NC}"
    fi

    # Phase 4: Cross-repo Pattern Analysis
    echo -e "\n${BOLD}${BLUE}PHASE 4: Cross-Repo Pattern Analysis${NC}"
    echo "─────────────────────────────────"
    bash "$SCRIPT_DIR/cross-repo-analysis.sh" 2>&1 | tee "$LOG_DIR/cycle-$CYCLE_TIME-cross.log" || echo -e "  ${YELLOW}⚠ Phase 4 had errors (continuing)${NC}"

    # Phase 5: Dashboard Update
    echo -e "\n${BOLD}${BLUE}PHASE 5: Dashboard Update${NC}"
    echo "─────────────────────────────────"
    bash "$SCRIPT_DIR/dashboard.sh" 2>&1 | tee "$LOG_DIR/cycle-$CYCLE_TIME-dashboard.log"

    # Summary
    echo -e "\n${BOLD}${CYAN}═══ CYCLE $CYCLE_NUM COMPLETE ═══${NC}"
    echo -e "  FYK Score: $(cat "$LOG_DIR"/fyk-audit-*.json 2>/dev/null | tail -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['score'])" 2>/dev/null || echo 'N/A')"
    echo -e "  Prompts:   $(ls "$PROMPT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ') generated"
    echo -e "  Reports:   $(ls "$REPORT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ') saved"
    echo -e "  Time:      $(date)"

    return 0
}

case "$MODE" in
    once)
        echo -e "${BOLD}Mode: Single run${NC}"
        run_full_cycle 1
        ;;
    daemon)
        echo -e "${BOLD}Mode: Daemon (continuous loop)${NC}"
        echo -e "  Audit interval: ${AUDIT_INTERVAL_MIN} minutes"
        echo -e "  Press Ctrl+C to stop"
        echo ""

        CYCLE=1
        while true; do
            run_full_cycle $CYCLE

            if [[ $CYCLE -lt 999 ]]; then
                echo -e "\n${YELLOW}Sleeping ${AUDIT_INTERVAL_MIN} minutes until next cycle...${NC}"
                echo -e "  (Press Ctrl+C to stop)"
                sleep $((AUDIT_INTERVAL_MIN * 60))
            fi

            ((CYCLE++))
        done
        ;;
    *)
        echo "Usage: $0 [once|daemon]"
        echo "  once   — Run one audit cycle"
        echo "  daemon — Run continuously every $AUDIT_INTERVAL_MIN minutes"
        exit 1
        ;;
esac
