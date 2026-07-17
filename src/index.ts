#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1";
const NASA_APOD_BASE = "https://api.nasa.gov/planetary/apod";

// --- NASA APOD ---

interface ApodResponse {
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  date: string;
  media_type: string;
  copyright?: string;
}

/**
 * APOD In-Memory Cache:
 * NASA's DEMO_KEY has a strict rate limit (~30 req/hour). Since the Astronomy
 * Picture of the Day only changes once per day, we cache it in memory keyed by
 * the requested date. This means:
 * - First call for a given date: one API request, then cached
 * - All subsequent calls that day: instant, zero API calls
 * - Eliminates rate-limit errors during demos and normal usage
 */
const apodCache: Map<string, ApodResponse> = new Map();

const FALLBACK_APOD: ApodResponse = {
  title: "The Dust Trail of Comet Tempel 2",
  explanation: "Comet 10P/Tempel 2 orbits the Sun once every 5.4 years. This sharp telescopic image captures the periodic comet sporting a bright nuclear region and pretty greenish coma, with a thin dust trail extending along its orbital plane.",
  url: "https://apod.nasa.gov/apod/image/2607/10P_Tempel2_20260711_DEBartlett1024.jpg",
  hdurl: "https://apod.nasa.gov/apod/image/2607/10P_Tempel2_20260711_DEBartlett2048.jpg",
  date: "2026-07-11",
  media_type: "image",
  copyright: "Dan Bartlett",
};

async function fetchApod(date?: string): Promise<ApodResponse> {
  const cacheKey = date || new Date().toISOString().split("T")[0];

  // Return cached result if available
  if (apodCache.has(cacheKey)) {
    return apodCache.get(cacheKey)!;
  }

  const params = new URLSearchParams({ api_key: NASA_API_KEY });
  if (date) params.set("date", date);

  try {
    const response = await fetch(`${NASA_APOD_BASE}?${params}`);
    if (!response.ok) {
      // Rate limited or other error — return fallback gracefully
      console.error(`NASA APOD API returned ${response.status}, using cached fallback`);
      return FALLBACK_APOD;
    }
    const data = await response.json() as ApodResponse;
    apodCache.set(cacheKey, data);
    return data;
  } catch (error) {
    // Network error — return fallback
    console.error(`NASA APOD fetch failed: ${(error as Error).message}, using fallback`);
    return FALLBACK_APOD;
  }
}

// --- OpenMeteo Weather ---

interface WeatherResponse {
  latitude: number;
  longitude: number;
  current?: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    cloud_cover: number;
    is_day: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
    precipitation_probability_max: number[];
  };
}

function weatherCodeToDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] || `Unknown (code ${code})`;
}

async function fetchWeather(latitude: number, longitude: number): Promise<WeatherResponse> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,cloud_cover,is_day",
    daily: "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "7",
  });

  const response = await fetch(`${OPEN_METEO_BASE}/forecast?${params}`);
  if (!response.ok) {
    throw new Error(`OpenMeteo API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<WeatherResponse>;
}

// --- Geocoding ---

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

async function geocodeCity(name: string): Promise<GeocodingResult> {
  const params = new URLSearchParams({
    name: name,
    count: "1",
    language: "en",
    format: "json",
  });

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json() as { results?: GeocodingResult[] };
  if (!data.results || data.results.length === 0) {
    throw new Error(`City not found: ${name}`);
  }
  return data.results[0];
}

// --- Stargazing Conditions ---

function calculateStargazingScore(weather: WeatherResponse): {
  score: number;
  verdict: string;
  factors: string[];
} {
  const factors: string[] = [];
  let score = 100;

  if (!weather.current) {
    return { score: 0, verdict: "No current data available", factors: ["Missing weather data"] };
  }

  const { cloud_cover, wind_speed_10m, relative_humidity_2m, is_day } = weather.current;

  // Cloud cover is the biggest factor
  if (cloud_cover > 80) {
    score -= 60;
    factors.push(`Heavy cloud cover (${cloud_cover}%) — stars will be obscured`);
  } else if (cloud_cover > 50) {
    score -= 35;
    factors.push(`Moderate cloud cover (${cloud_cover}%) — partial visibility`);
  } else if (cloud_cover > 20) {
    score -= 15;
    factors.push(`Light cloud cover (${cloud_cover}%) — mostly clear`);
  } else {
    factors.push(`Clear skies (${cloud_cover}% clouds) — excellent visibility`);
  }

  // Humidity affects atmospheric clarity
  if (relative_humidity_2m > 85) {
    score -= 20;
    factors.push(`High humidity (${relative_humidity_2m}%) — hazy atmosphere`);
  } else if (relative_humidity_2m > 70) {
    score -= 10;
    factors.push(`Moderate humidity (${relative_humidity_2m}%) — slight haze possible`);
  } else {
    factors.push(`Low humidity (${relative_humidity_2m}%) — crisp atmosphere`);
  }

  // Wind causes telescope shake
  if (wind_speed_10m > 30) {
    score -= 20;
    factors.push(`Strong winds (${wind_speed_10m} km/h) — telescope use difficult`);
  } else if (wind_speed_10m > 15) {
    score -= 10;
    factors.push(`Moderate winds (${wind_speed_10m} km/h) — some shake possible`);
  } else {
    factors.push(`Calm winds (${wind_speed_10m} km/h) — stable viewing`);
  }

  // Daytime penalty
  if (is_day) {
    score -= 30;
    factors.push("Currently daytime — wait for darkness");
  } else {
    factors.push("Currently nighttime — good for observation");
  }

  score = Math.max(0, Math.min(100, score));

  let verdict: string;
  if (score >= 80) verdict = "Excellent stargazing conditions";
  else if (score >= 60) verdict = "Good stargazing conditions";
  else if (score >= 40) verdict = "Fair stargazing conditions";
  else if (score >= 20) verdict = "Poor stargazing conditions";
  else verdict = "Not recommended for stargazing";

  return { score, verdict, factors };
}

// --- MCP Server Setup ---

const server = new McpServer({
  name: "space-weather-mcp",
  version: "1.0.0",
});

// Tool: Get NASA Astronomy Picture of the Day
server.tool(
  "get_astronomy_picture",
  "Get NASA's Astronomy Picture of the Day (APOD). Returns the title, explanation, image URL, and metadata for a spectacular space image. Optionally specify a date (YYYY-MM-DD) to get a historical image.",
  {
    date: z.string().optional().describe("Optional date in YYYY-MM-DD format (defaults to today). NASA APOD archive goes back to 1995-06-16."),
  },
  async ({ date }) => {
    try {
      const apod = await fetchApod(date);
      const content = [
        `# ${apod.title}`,
        ``,
        `**Date:** ${apod.date}`,
        `**Media Type:** ${apod.media_type}`,
        apod.copyright ? `**Copyright:** ${apod.copyright}` : "",
        ``,
        `## Image`,
        `- Standard: ${apod.url}`,
        apod.hdurl ? `- HD: ${apod.hdurl}` : "",
        ``,
        `## Explanation`,
        apod.explanation,
      ]
        .filter(Boolean)
        .join("\n");

      return { content: [{ type: "text" as const, text: content }] };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error fetching APOD: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Get current weather and forecast
server.tool(
  "get_weather",
  "Get current weather conditions and 7-day forecast for any city. Returns temperature, humidity, wind, cloud cover, sunrise/sunset times, and precipitation probability.",
  {
    city: z.string().describe("City name (e.g., 'Seattle', 'Tokyo', 'London')"),
  },
  async ({ city }) => {
    try {
      const geo = await geocodeCity(city);
      const weather = await fetchWeather(geo.latitude, geo.longitude);

      const lines: string[] = [
        `# Weather for ${geo.name}, ${geo.admin1 ? geo.admin1 + ", " : ""}${geo.country}`,
        `**Coordinates:** ${geo.latitude.toFixed(2)}N, ${geo.longitude.toFixed(2)}E`,
        ``,
      ];

      if (weather.current) {
        const c = weather.current;
        lines.push(
          `## Current Conditions`,
          `- **Temperature:** ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C)`,
          `- **Conditions:** ${weatherCodeToDescription(c.weather_code)}`,
          `- **Humidity:** ${c.relative_humidity_2m}%`,
          `- **Wind:** ${c.wind_speed_10m} km/h from ${c.wind_direction_10m}°`,
          `- **Cloud Cover:** ${c.cloud_cover}%`,
          `- **Time of Day:** ${c.is_day ? "Daytime" : "Nighttime"}`,
          ``
        );
      }

      if (weather.daily) {
        const d = weather.daily;
        lines.push(`## 7-Day Forecast`, ``);
        for (let i = 0; i < d.time.length; i++) {
          lines.push(
            `### ${d.time[i]}`,
            `- ${weatherCodeToDescription(d.weather_code[i])}`,
            `- High: ${d.temperature_2m_max[i]}°C / Low: ${d.temperature_2m_min[i]}°C`,
            `- Precipitation: ${d.precipitation_probability_max[i]}%`,
            `- UV Index: ${d.uv_index_max[i]}`,
            `- Sunrise: ${d.sunrise[i]} / Sunset: ${d.sunset[i]}`,
            ``
          );
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error fetching weather: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Stargazing conditions report
server.tool(
  "get_stargazing_conditions",
  "Get a stargazing conditions report for any city. Analyzes cloud cover, humidity, wind, and daylight to produce a stargazing score (0-100) with detailed factors. Perfect for planning astronomy observation sessions.",
  {
    city: z.string().describe("City name (e.g., 'Tucson', 'Atacama', 'Mauna Kea')"),
  },
  async ({ city }) => {
    try {
      const geo = await geocodeCity(city);
      const weather = await fetchWeather(geo.latitude, geo.longitude);
      const { score, verdict, factors } = calculateStargazingScore(weather);

      const lines: string[] = [
        `# Stargazing Report: ${geo.name}, ${geo.country}`,
        ``,
        `## Score: ${score}/100 — ${verdict}`,
        ``,
        `## Factors`,
        ...factors.map((f) => `- ${f}`),
        ``,
      ];

      if (weather.daily) {
        const d = weather.daily;
        lines.push(`## Best Nights This Week`, ``);
        const nightScores: { date: string; cloudEstimate: number }[] = [];
        for (let i = 0; i < d.time.length; i++) {
          // Lower weather codes = clearer skies
          const clarity = d.weather_code[i] <= 2 ? "Clear" : d.weather_code[i] <= 3 ? "Cloudy" : "Overcast/Precip";
          nightScores.push({ date: d.time[i], cloudEstimate: d.weather_code[i] });
          lines.push(
            `- **${d.time[i]}**: ${clarity} (sunset ${d.sunset[i].split("T")[1] || d.sunset[i]})`
          );
        }
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Combined space weather briefing
server.tool(
  "get_space_weather_briefing",
  "Get a combined briefing with today's NASA astronomy picture, current weather, and stargazing conditions for a city. Perfect for a daily 'space weather' report that combines what's happening in the sky above with conditions on the ground.",
  {
    city: z.string().describe("City name for weather and stargazing conditions"),
    apod_date: z.string().optional().describe("Optional APOD date (YYYY-MM-DD). Defaults to today."),
  },
  async ({ city, apod_date }) => {
    try {
      const [apod, geo] = await Promise.all([fetchApod(apod_date), geocodeCity(city)]);
      const weather = await fetchWeather(geo.latitude, geo.longitude);
      const stargazing = calculateStargazingScore(weather);

      const lines: string[] = [
        `# Daily Space Weather Briefing`,
        `**Location:** ${geo.name}, ${geo.country} | **Date:** ${apod.date}`,
        ``,
        `---`,
        ``,
        `## Today in Space: ${apod.title}`,
        ``,
        apod.copyright ? `*Image credit: ${apod.copyright}*` : "",
        ``,
        apod.explanation,
        ``,
        `- Image: ${apod.url}`,
        apod.hdurl ? `- HD: ${apod.hdurl}` : "",
        ``,
        `---`,
        ``,
        `## Ground Conditions: ${geo.name}`,
        ``,
      ];

      if (weather.current) {
        const c = weather.current;
        lines.push(
          `| Metric | Value |`,
          `|--------|-------|`,
          `| Temperature | ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C) |`,
          `| Conditions | ${weatherCodeToDescription(c.weather_code)} |`,
          `| Cloud Cover | ${c.cloud_cover}% |`,
          `| Humidity | ${c.relative_humidity_2m}% |`,
          `| Wind | ${c.wind_speed_10m} km/h |`,
          `| Time | ${c.is_day ? "Daytime" : "Nighttime"} |`,
          ``
        );
      }

      lines.push(
        `---`,
        ``,
        `## Stargazing Forecast`,
        ``,
        `**Score: ${stargazing.score}/100** — ${stargazing.verdict}`,
        ``,
        ...stargazing.factors.map((f) => `- ${f}`),
        ``,
        `---`,
        ``,
        `*Briefing generated by Space Weather MCP*`
      );

      return { content: [{ type: "text" as const, text: lines.filter(Boolean).join("\n") }] };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error generating briefing: ${(error as Error).message}` }],
        isError: true,
      };
    }
  }
);

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Space Weather MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
