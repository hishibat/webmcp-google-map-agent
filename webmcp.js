(function () {
  "use strict";

  const toolSpecs = [
    {
      name: "natural_language_map_command",
      title: "Natural language map command",
      description: "Operate the Google Maps view from a natural language instruction. Supports place search, local search, rating/review hints, routes, travel mode, zoom, and satellite map mode.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Natural language command, for example '評価4.5以上の日本食レストラン' or '東京駅から東京タワーまで徒歩'." }
        },
        required: ["command"]
      },
      annotations: { readOnlyHint: false }
    },
    {
      name: "search_google_maps",
      title: "Search Google Maps",
      description: "Search Google Maps for a place, address, or category. Add optional context and rating/review hints such as ratingMin or reviewsMin.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Place, address, or category to search." },
          context: { type: "string", description: "Optional location context." },
          ratingMin: { type: "number", description: "Minimum desired Google Maps rating, folded into the search query as a hint." },
          reviewsMin: { type: "number", description: "Minimum desired review count, folded into the search query as a hint." },
          highRated: { type: "boolean", description: "Prefer highly rated results." },
          zoom: { type: "number", description: "Map zoom from 3 to 21." },
          mapType: { type: "string", enum: ["roadmap", "satellite"], description: "Map visual mode." }
        },
        required: ["query"]
      },
      annotations: { readOnlyHint: false }
    },
    {
      name: "route_google_maps",
      title: "Route Google Maps",
      description: "Show a Google Maps route from an origin to a destination with driving, walking, transit, or bicycling mode.",
      inputSchema: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Starting place or address." },
          destination: { type: "string", description: "Destination place or address." },
          travelMode: { type: "string", enum: ["driving", "walking", "transit", "bicycling"] },
          zoom: { type: "number", description: "Map zoom from 3 to 21." }
        },
        required: ["origin", "destination"]
      },
      annotations: { readOnlyHint: false }
    },
    {
      name: "set_map_zoom",
      title: "Set map zoom",
      description: "Set an absolute zoom level or adjust the current Google Maps zoom by a delta.",
      inputSchema: { type: "object", properties: { zoom: { type: "number" }, delta: { type: "number" } } },
      annotations: { readOnlyHint: false }
    },
    {
      name: "get_current_search",
      title: "Get current map state",
      description: "Return the current Google Maps intent, target, route, zoom, generated URL, and iframe URL.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true }
    }
  ];

  function getMapApi() {
    if (!window.NLMap) throw new Error("Map app is not ready yet.");
    return window.NLMap;
  }

  function asToolResult(payload) {
    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }], structuredContent: payload };
  }

  const handlers = {
    natural_language_map_command: async (input) => asToolResult(getMapApi().runCommand(input.command || "", "webmcp")),
    search_google_maps: async (input) => asToolResult(getMapApi().search(input || {}, "webmcp")),
    route_google_maps: async (input) => asToolResult(getMapApi().route(input || {}, "webmcp")),
    set_map_zoom: async (input) => {
      const current = getMapApi().getState();
      const nextZoom = Number.isFinite(Number(input.zoom)) ? Number(input.zoom) : current.zoom + Number(input.delta || 0);
      return asToolResult(getMapApi().setZoom(nextZoom, "webmcp"));
    },
    get_current_search: async () => asToolResult(getMapApi().getState())
  };

  function buildNativeTool(spec) {
    return { ...spec, execute: (input) => handlers[spec.name](input || {}) };
  }

  function registerNativeWebMCP() {
    const modelContext = navigator.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== "function") {
      getMapApi().setWebMCPStatus("WebMCP fallback", false);
      return false;
    }
    try {
      toolSpecs.forEach((spec) => modelContext.registerTool(buildNativeTool(spec)));
      getMapApi().setWebMCPStatus("WebMCP ready", true);
      return true;
    } catch (error) {
      console.warn("WebMCP registration failed:", error);
      getMapApi().setWebMCPStatus("WebMCP fallback", false);
      return false;
    }
  }

  function registerWhenReady() {
    if (window.NLMap) registerNativeWebMCP();
  }

  window.WebMCPGoogleMap = {
    tools: toolSpecs.map((tool) => ({ ...tool })),
    callTool(name, input) {
      if (!handlers[name]) throw new Error(`Unknown tool: ${name}`);
      return handlers[name](input || {});
    }
  };

  window.addEventListener("nl-map-ready", registerWhenReady, { once: true });
  registerWhenReady();
})();
