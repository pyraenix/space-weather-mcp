/**
 * Space Weather Journal Generator
 *
 * This script demonstrates what the MCP integration enables:
 * it calls the same APIs the MCP server exposes and generates
 * a beautiful Markdown journal entry combining astronomy + weather data.
 *
 * Usage:
 *   npx tsx demo/generate-briefing.ts [city]
 *
 * Example:
 *   npx tsx demo/generate-briefing.ts "San Francisco"
 *   npx tsx demo/generate-briefing.ts Tokyo
 */

const NASA_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

interface ApodData {
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  date: string;
  media_type: string;
  copyright?: string;
}

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

function weatherCodeToDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snowfall", 73: "Moderate snowfall", 75: "Heavy snowfall",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
  };
  return descriptions[code] || `Unknown (code ${code})`;
}

function getStargazingEmoji(score: number): string {
  if (score >= 80) return "🌟";
  if (score >= 60) return "⭐";
  if (score >= 40) return "🌤️";
  if (score >= 20) return "☁️";
  return "🌧️";
}

async function main() {
  const city = process.argv[2] || "Seattle";
  const today = new Date().toISOString().split("T")[0];

  console.log(`\n🚀 Generating Space Weather Journal for ${city}...\n`);

  // Fetch NASA APOD
  const apodRes = await fetch(
    `https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`
  );
  if (!apodRes.ok) throw new Error(`APOD fetch failed: ${apodRes.status}`);
  const apod: ApodData = await apodRes.json() as ApodData;

  // Geocode city
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );
  if (!geoRes.ok) throw new Error(`Geocoding failed: ${geoRes.status}`);
  const geoData = await geoRes.json() as { results?: GeoResult[] };
  if (!geoData.results?.length) throw new Error(`City not found: ${city}`);
  const geo = geoData.results[0];

  // Fetch weather
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,cloud_cover,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto&forecast_days=3`
  );
  if (!weatherRes.ok) throw new Error(`Weather fetch failed: ${weatherRes.status}`);
  const weather = await weatherRes.json() as any;

  // Calculate stargazing score
  const current = weather.current;
  let score = 100;
  if (current.cloud_cover > 80) score -= 60;
  else if (current.cloud_cover > 50) score -= 35;
  else if (current.cloud_cover > 20) score -= 15;
  if (current.relative_humidity_2m > 85) score -= 20;
  else if (current.relative_humidity_2m > 70) score -= 10;
  if (current.wind_speed_10m > 30) score -= 20;
  else if (current.wind_speed_10m > 15) score -= 10;
  if (current.is_day) score -= 30;
  score = Math.max(0, Math.min(100, score));

  const emoji = getStargazingEmoji(score);
  const verdict =
    score >= 80 ? "Excellent" :
    score >= 60 ? "Good" :
    score >= 40 ? "Fair" :
    score >= 20 ? "Poor" : "Not recommended";

  // Generate the journal
  const journal = `# ${emoji} Space Weather Journal — ${today}
**Location:** ${geo.name}, ${geo.admin1 ? geo.admin1 + ", " : ""}${geo.country}

---

## 🔭 Today in Space: ${apod.title}

${apod.copyright ? `*Credit: ${apod.copyright}*\n` : ""}
${apod.explanation}

![${apod.title}](${apod.url})

${apod.hdurl ? `[View in HD](${apod.hdurl})` : ""}

---

## 🌡️ Ground Conditions

| Metric | Value |
|--------|-------|
| Temperature | ${current.temperature_2m}°C (feels like ${current.apparent_temperature}°C) |
| Conditions | ${weatherCodeToDescription(current.weather_code)} |
| Cloud Cover | ${current.cloud_cover}% |
| Humidity | ${current.relative_humidity_2m}% |
| Wind | ${current.wind_speed_10m} km/h |
| Daylight | ${current.is_day ? "☀️ Day" : "🌙 Night"} |

---

## ${emoji} Stargazing Score: ${score}/100 — ${verdict}

${current.cloud_cover <= 20 ? "✅ Clear skies — excellent visibility" : current.cloud_cover <= 50 ? "⚠️ Partial clouds — some stars visible" : "❌ Heavy cloud cover — limited visibility"}
${current.relative_humidity_2m <= 70 ? "✅ Low humidity — crisp atmosphere" : "⚠️ High humidity — possible haze"}
${current.wind_speed_10m <= 15 ? "✅ Calm winds — stable for telescopes" : "⚠️ Windy — telescope shake likely"}
${current.is_day ? "⏰ Wait for sunset to observe" : "✅ It's dark — go outside now!"}

---

## 📅 3-Day Outlook

${weather.daily.time.slice(0, 3).map((date: string, i: number) => {
  const code = weather.daily.weather_code[i];
  const clearNight = code <= 2;
  return `| ${date} | ${weatherCodeToDescription(code)} | High ${weather.daily.temperature_2m_max[i]}°C | Sunset ${weather.daily.sunset[i].split("T")[1]} | ${clearNight ? "🌟 Good night" : "☁️ Cloudy night"} |`;
}).join("\n")}

---

*Generated by Space Weather MCP — connecting Kiro to the cosmos*
`;

  // Write to file
  const filename = `space-journal-${today}.md`;
  const fs = await import("fs");
  fs.writeFileSync(filename, journal);
  console.log(journal);
  console.log(`\n✅ Journal saved to ${filename}\n`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
