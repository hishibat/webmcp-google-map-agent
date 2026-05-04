# WebMCP GoogleMap Agent

Natural-language Google Maps controller inspired by Rikuo's X post about a WebMCP-powered GoogleMap demo with no server cost and no API fee.

This repository is a static web app. It uses Google Maps URLs and embeddable map pages instead of the Google Maps JavaScript API, so there is no backend and no Google Maps Platform API key in the app.

## Run

```powershell
cd "C:\Users\Hideyuki Shibata\workspace\Games\webmcp-google-map-agent"
python -m http.server 8787
```

Open:

```text
http://localhost:8787/
```

## Natural Commands

Examples:

- `渋谷でおすすめのボードゲームカフェ`
- `評価4.5以上の日本食レストラン`
- `渋谷で評価4.3以上、口コミ100件以上の寿司`
- `東京駅から東京タワーまで徒歩`
- `京都駅周辺のラーメン`
- `パリの美術館を検索`
- `もっと拡大`
- `航空写真にして`

The parser runs fully in the browser. It recognizes search, local search, rating and review-count hints, route, travel mode, zoom, and satellite mode intents.

## iPhone

The normal UI works on iPhone as a static website. For a good phone experience, host it over HTTPS and add it to the Home Screen. The page includes iOS safe-area spacing, 44px touch targets, a 16px prompt font to avoid Safari input zoom, and a web app manifest.

WebMCP tool access on iPhone depends on the browser or AI client. If the mobile browser does not expose `navigator.modelContext.registerTool`, the app still works through the visible prompt UI, but an agent will not be able to call the registered tools directly.

## WebMCP

When `navigator.modelContext.registerTool` is available, the page registers these tools:

- `natural_language_map_command`
- `search_google_maps`
- `route_google_maps`
- `set_map_zoom`
- `get_current_search`

For normal browsers or local testing, the same tools are exposed as `window.WebMCPGoogleMap.callTool(name, input)`.

## Notes

Google Maps itself is loaded from Google in an iframe. The app avoids Google Maps Platform API billing by constructing Maps URLs locally; Google Maps availability, product behavior, rate protection, and usage terms still apply to the embedded service.

Rating and review-count conditions are translated into Google Maps search text, for example `日本食レストラン 評価4.5以上`. Without the Places API, the app cannot fetch every result and strictly filter it locally.

WebMCP exposes the page's client-side functions as tools. It does not make Google Maps data free, unlimited, or locally owned; it just lets an AI-capable browser call the same frontend functions that the UI uses.
