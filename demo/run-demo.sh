#!/bin/bash
# Space Weather MCP — Automated Demo
# Just run this and record your screen!

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Simulated typing effect
type_text() {
  local text="$1"
  for (( i=0; i<${#text}; i++ )); do
    printf '%s' "${text:$i:1}"
    sleep 0.04
  done
  echo ""
}

# Pause with a visual indicator
pause() {
  sleep "${1:-2}"
}

# Section header
section() {
  echo ""
  echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  sleep 1
}

clear

# --- INTRO ---
echo ""
echo -e "${BOLD}${CYAN}"
echo "   ╔═══════════════════════════════════════════════════╗"
echo "   ║       🚀 Space Weather MCP — Live Demo           ║"
echo "   ║   Kiro Birthday Challenge Day 5                  ║"
echo "   ╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${DIM}  A custom MCP server connecting Kiro to NASA + OpenMeteo${NC}"
echo ""
pause 3

# --- SCENE 1: Show the MCP config ---
section "1. MCP Server Configuration"

echo -e "${DIM}$ cat .kiro/settings/mcp.json${NC}"
pause 1
echo -e "${GREEN}"
cat <<'EOF'
{
  "mcpServers": {
    "space-weather": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "${workspaceFolder}",
      "env": {
        "NASA_API_KEY": "${env:NASA_API_KEY}"
      },
      "disabled": false
    }
  }
}
EOF
echo -e "${NC}"
pause 3

# --- SCENE 2: Show the server starting and listing tools ---
section "2. MCP Server — Tools Available"

echo -e "${DIM}$ Starting space-weather MCP server...${NC}"
pause 1
echo ""
echo -e "${GREEN}✓ Server connected: space-weather-mcp v1.0.0${NC}"
echo ""
echo -e "${BOLD}Available tools:${NC}"
echo -e "  ${CYAN}1.${NC} get_astronomy_picture  — NASA Astronomy Picture of the Day"
echo -e "  ${CYAN}2.${NC} get_weather            — Current conditions + 7-day forecast"
echo -e "  ${CYAN}3.${NC} get_stargazing_conditions — Stargazing score (0-100)"
echo -e "  ${CYAN}4.${NC} get_space_weather_briefing — Combined space + weather report"
echo ""
pause 3

# --- SCENE 3: Call stargazing conditions ---
section "3. Calling: get_stargazing_conditions"

echo -e "${DIM}Prompt: \"What are the stargazing conditions tonight in Tucson?\"${NC}"
echo ""
echo -e "${YELLOW}→ Calling tool: get_stargazing_conditions({ city: \"Tucson\" })${NC}"
pause 1
echo -e "${DIM}  Geocoding Tucson... ✓${NC}"
sleep 0.5
echo -e "${DIM}  Fetching weather from OpenMeteo... ✓${NC}"
sleep 0.5
echo -e "${DIM}  Computing stargazing score... ✓${NC}"
echo ""
pause 1

# Actually call the API
cd "$(dirname "$0")/.."
RESULT=$(printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"1.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"notifications/initialized","params":{}}\n{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_stargazing_conditions","arguments":{"city":"Tucson"}}}\n' | node dist/index.js 2>/dev/null | tail -1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['content'][0]['text'])" 2>/dev/null)

echo -e "${GREEN}${RESULT}${NC}"
echo ""
pause 5

# --- SCENE 4: Call full briefing ---
section "4. Calling: get_space_weather_briefing"

echo -e "${DIM}Prompt: \"Give me a full space weather briefing for Tokyo\"${NC}"
echo ""
echo -e "${YELLOW}→ Calling tool: get_space_weather_briefing({ city: \"Tokyo\" })${NC}"
pause 1
echo -e "${DIM}  Fetching NASA APOD... ✓${NC}"
sleep 1
echo -e "${DIM}  Geocoding Tokyo... ✓${NC}"
sleep 0.5
echo -e "${DIM}  Fetching weather from OpenMeteo... ✓${NC}"
sleep 0.5
echo -e "${DIM}  Computing stargazing score... ✓${NC}"
echo ""
pause 2

RESULT2=$(printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"1.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"notifications/initialized","params":{}}\n{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_space_weather_briefing","arguments":{"city":"Tokyo"}}}\n' | node dist/index.js 2>/dev/null | tail -1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['content'][0]['text'])" 2>/dev/null)

echo -e "${GREEN}${RESULT2}${NC}"
echo ""
pause 5

# --- SCENE 5: Web dashboard mention ---
section "5. Bonus: Web Dashboard"

echo -e "  The same APIs also power a browser-based Space Weather Dashboard."
echo -e "  ${CYAN}→ Starting local server on http://localhost:3000${NC}"
echo ""
# Start a local server so the URL shows localhost instead of a file path
npx serve web -p 3000 --no-clipboard 2>/dev/null &
SERVER_PID=$!
sleep 4
open http://localhost:3000 2>/dev/null
echo -e "  ${GREEN}✓ Dashboard open at http://localhost:3000${NC}"
echo ""
echo -e "${DIM}  (Press Enter to finish demo and stop server)${NC}"
read -r
# Clean up the server
kill $SERVER_PID 2>/dev/null

# --- END ---
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}  ✓ Demo complete — Space Weather MCP${NC}"
echo -e "${DIM}  Built for Kiro Birthday Challenge Day 5${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
