# Space Weather MCP

A custom MCP (Model Context Protocol) server that connects Kiro to NASA and weather APIs, enabling space-aware daily briefings, stargazing condition reports, and astronomy picture exploration — all from within your IDE.

## Demo

> **Video:** [Space Weather MCP Demo (mp4)](./demo/space-weather-demo.mp4)
>
> **Repo:** [github.com/pyraenix/space-weather-mcp](https://github.com/pyraenix/space-weather-mcp)

## What It Connects To

| API | What it provides | Auth |
|-----|-----------------|------|
| [NASA APOD](https://api.nasa.gov/) | Astronomy Picture of the Day — title, explanation, image URLs | Free key (or `DEMO_KEY`) |
| [OpenMeteo Weather](https://open-meteo.com/) | Current conditions, 7-day forecast, sunrise/sunset | No key needed |
| [OpenMeteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | City name → coordinates | No key needed |

## MCP Tools Provided

| Tool | Description |
|------|-------------|
| `get_astronomy_picture` | Fetch NASA's Astronomy Picture of the Day (optional date param for archive) |
| `get_weather` | Current weather + 7-day forecast for any city worldwide |
| `get_stargazing_conditions` | Stargazing score (0-100) based on cloud cover, humidity, wind, and daylight |
| `get_space_weather_briefing` | Combined report: APOD + weather + stargazing in a single call |

## What I Built With It

A **Space Weather Journal Generator** that produces daily Markdown briefings combining:

1. What's happening in space today (NASA's picture of the day with full explanation)
2. Ground-level weather conditions for your city
3. A computed stargazing score telling you whether tonight is worth going outside

This is something Kiro **cannot do without the MCP integration** — it has no native access to live weather data or NASA's daily content. The MCP server gives Kiro real-time awareness of both astronomical events and local sky conditions.

### Example Output

```
# 🌤️ Space Weather Journal — 2026-07-17
**Location:** Seattle, Washington, United States

## 🔭 Today in Space: The Dust Trail of Comet Tempel 2
Comet 10P/Tempel 2 orbits the Sun once every 5.4 years...

## 🌡️ Ground Conditions
| Temperature | 19°C (feels like 20.5°C) |
| Conditions  | Mainly clear              |
| Cloud Cover | 25%                       |

## 🌤️ Stargazing Score: 55/100 — Fair
⚠️ Partial clouds — some stars visible
✅ Low humidity — crisp atmosphere
✅ Calm winds — stable for telescopes
⏰ Wait for sunset to observe
```

## Setup

### Prerequisites

- Node.js 18+
- (Optional) NASA API key from [api.nasa.gov](https://api.nasa.gov/) — works without one using `DEMO_KEY`

### Installation

```bash
git clone <repo-url>
cd space-weather-mcp

# Install dependencies
npm install

# Build the MCP server
npm run build
```

### Environment Variables

```bash
cp .env.example .env
```

```bash
# Optional — the server works without this (uses DEMO_KEY with rate limits)
NASA_API_KEY=your_nasa_api_key_here
```

### Configure in Kiro

The `.kiro/settings/mcp.json` is already included. If you're adding this to an existing project, add to your MCP config:

```json
{
  "mcpServers": {
    "space-weather": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/space-weather-mcp",
      "env": {
        "NASA_API_KEY": "${env:NASA_API_KEY}"
      },
      "disabled": false
    }
  }
}
```

### Run the Demo

```bash
# Generate a space weather journal for any city
npx tsx demo/generate-briefing.ts "San Francisco"
npx tsx demo/generate-briefing.ts Tokyo
npx tsx demo/generate-briefing.ts London
```

### Use in Kiro

Once the MCP server is configured, ask Kiro things like:

- "What's NASA's astronomy picture today?"
- "What are the stargazing conditions in Tucson tonight?"
- "Give me a full space weather briefing for my location"
- "Show me the APOD from my birthday (1995-06-16)"

## Project Structure

```
space-weather-mcp/
├── .kiro/
│   ├── settings/mcp.json      # MCP server configuration
│   └── steering/space-weather.md  # Agent behavior guidance
├── src/
│   └── index.ts               # MCP server implementation (4 tools)
├── demo/
│   └── generate-briefing.ts   # Demo script — generates Markdown journals
├── dist/                      # Compiled output (after npm run build)
├── .env.example               # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

The MCP server runs on stdio transport (standard for Kiro MCP integrations). When Kiro starts, it launches the server as a child process and communicates via JSON-RPC over stdin/stdout.

```
┌─────────┐  stdio (JSON-RPC)  ┌──────────────────┐  HTTPS  ┌──────────────┐
│  Kiro   │ ◄────────────────► │  Space Weather   │ ◄──────► │  NASA APOD   │
│  IDE    │                     │  MCP Server      │          │  OpenMeteo   │
└─────────┘                     └──────────────────┘          └──────────────┘
```

The stargazing score is computed locally by the server using a weighted formula:
- Cloud cover (0-60 point penalty)
- Humidity (0-20 point penalty)
- Wind speed (0-20 point penalty)
- Daytime (30 point penalty)

## Tech Stack

- **Runtime**: Node.js 18+, TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk` ^1.12.1
- **APIs**: NASA APOD (free), OpenMeteo (free, no key)
- **Dev Tools**: Kiro (MCP, steering, specs)

## Kiro Birthday Challenge — Day 5

Built for the Kiro Birthday Challenge Day 5: "Build a custom MCP integration." This MCP server connects Kiro to real-time space and weather data it has no native access to, then uses that connection to generate contextual astronomy briefings that combine what's happening in space with conditions on the ground.

## License

MIT
