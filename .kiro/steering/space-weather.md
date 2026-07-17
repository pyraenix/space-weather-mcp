# Space Weather MCP Usage

This project includes a custom MCP server that connects Kiro to NASA and weather APIs.

## Available MCP Tools

When the space-weather MCP server is running, you have access to:

1. **get_astronomy_picture** — Fetch NASA's Astronomy Picture of the Day (optional date param)
2. **get_weather** — Get current conditions and 7-day forecast for any city
3. **get_stargazing_conditions** — Get a stargazing score (0-100) with factors for any location
4. **get_space_weather_briefing** — Combined report: APOD + weather + stargazing in one call

## When to Use These Tools

- When the user asks about weather, astronomy, stargazing, or space topics
- When generating daily briefings or journal entries
- When planning outdoor or observation activities
- When creating content that combines space imagery with local conditions

## Output Style

When presenting space weather data:
- Use markdown formatting with headers and tables
- Include relevant emojis for visual scanning
- Always mention the stargazing score when weather data is present
- Link to NASA images when available
