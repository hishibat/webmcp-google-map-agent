(function () {
  "use strict";

  const examples = [
    "渋谷でおすすめのボードゲームカフェ",
    "評価4.5以上の日本食レストラン",
    "東京駅から東京タワーまで徒歩",
    "京都駅周辺のラーメン",
    "パリの美術館を検索",
    "もっと拡大"
  ];

  const toolNames = [
    "natural_language_map_command",
    "search_google_maps",
    "route_google_maps",
    "set_map_zoom",
    "get_current_search"
  ];

  const state = {
    intent: "search",
    query: "Tokyo Tower",
    origin: "",
    destination: "",
    travelMode: "map",
    zoom: 14,
    mapType: "roadmap",
    filters: {},
    embedUrl: "",
    openUrl: "",
    generatedUrl: "",
    trace: [],
    history: []
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    [
      "mapFrame", "webmcpStatus", "mapModeLabel", "zoomOutButton", "zoomInButton", "openMapsButton",
      "commandForm", "commandInput", "promptChips", "intentValue", "targetValue", "zoomValue", "travelValue",
      "conditionsValue", "traceList", "toolList", "generatedUrl", "historyList"
    ].forEach((id) => { els[id] = document.getElementById(id); });

    renderExamples();
    renderTools();
    bindEvents();
    applyParsedCommand(parseNaturalCommand("東京タワーを表示"), "init");

    window.NLMap = { runCommand, search, route, setZoom, getState: getPublicState, setWebMCPStatus };
    window.dispatchEvent(new CustomEvent("nl-map-ready", { detail: getPublicState() }));
  }

  function bindEvents() {
    els.commandForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const command = els.commandInput.value.trim();
      if (command) runCommand(command, "user");
    });
    els.commandInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        els.commandForm.requestSubmit();
      }
    });
    els.zoomInButton.addEventListener("click", () => setZoom(state.zoom + 2, "button"));
    els.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 2, "button"));
    els.openMapsButton.addEventListener("click", () => window.open(state.openUrl, "_blank", "noopener,noreferrer"));
  }

  function renderExamples() {
    els.promptChips.replaceChildren();
    examples.forEach((example) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = example;
      button.addEventListener("click", () => {
        els.commandInput.value = example;
        runCommand(example, "chip");
      });
      els.promptChips.appendChild(button);
    });
  }

  function renderTools() {
    const summaries = {
      natural_language_map_command: "自然文から地図操作を実行",
      search_google_maps: "検索語とズームで地図を更新",
      route_google_maps: "出発地と目的地から経路を表示",
      set_map_zoom: "現在の表示を拡大または縮小",
      get_current_search: "現在の地図状態を返却"
    };
    els.toolList.replaceChildren();
    toolNames.forEach((name) => {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = name;
      span.textContent = summaries[name] || "Map tool";
      li.append(strong, span);
      els.toolList.appendChild(li);
    });
  }

  function runCommand(command, source) {
    return applyParsedCommand(parseNaturalCommand(command), source || "command");
  }

  function search(args, source) {
    const filters = normalizeFilters(args);
    const baseQuery = compact([args.context, args.query].filter(Boolean).join(" ")) || state.query;
    const query = appendSearchFilters(baseQuery, filters);
    return applyParsedCommand({
      intent: "search",
      query,
      filters,
      zoom: clampZoom(args.zoom || state.zoom),
      mapType: args.mapType || state.mapType,
      summary: query,
      trace: withFilterTrace([["intent", "search"], ["tool", "search_google_maps"], ["query", query]], filters)
    }, source || "tool");
  }

  function route(args, source) {
    const origin = compact(args.origin || state.origin || state.query);
    const destination = compact(args.destination || state.destination || state.query);
    return applyParsedCommand({
      intent: "route",
      origin,
      destination,
      travelMode: normalizeTravelMode(args.travelMode || args.mode || "driving"),
      filters: {},
      zoom: clampZoom(args.zoom || state.zoom),
      summary: `${origin} -> ${destination}`,
      trace: [["intent", "route"], ["tool", "route_google_maps"], ["origin", origin], ["destination", destination]]
    }, source || "tool");
  }

  function setZoom(nextZoom, source) {
    const zoom = clampZoom(nextZoom);
    return applyParsedCommand({
      intent: state.intent,
      query: state.query,
      origin: state.origin,
      destination: state.destination,
      travelMode: state.travelMode,
      filters: state.filters,
      zoom,
      mapType: state.mapType,
      summary: `zoom ${zoom}`,
      trace: [["intent", "zoom"], ["tool", "set_map_zoom"], ["zoom", String(zoom)]]
    }, source || "zoom");
  }

  function applyParsedCommand(parsed, source) {
    state.intent = parsed.intent || state.intent;
    state.zoom = clampZoom(parsed.zoom || state.zoom);
    state.mapType = parsed.mapType || state.mapType;
    if (Object.prototype.hasOwnProperty.call(parsed, "filters")) state.filters = normalizeFilters(parsed.filters);

    if (state.intent === "route") {
      state.origin = parsed.origin || state.origin || state.query;
      state.destination = parsed.destination || state.destination || state.query;
      state.travelMode = normalizeTravelMode(parsed.travelMode || state.travelMode || "driving");
      state.query = compact(`${state.origin} to ${state.destination}`);
      state.filters = {};
    } else {
      state.query = compact(parsed.query || state.query);
      state.origin = "";
      state.destination = "";
      state.travelMode = "map";
    }

    const urls = buildUrls(state);
    state.embedUrl = urls.embedUrl;
    state.openUrl = urls.openUrl;
    state.generatedUrl = urls.generatedUrl;
    state.trace = parsed.trace || [];
    state.history.unshift({
      source,
      intent: state.intent,
      summary: parsed.summary || getTargetLabel(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    });
    state.history = state.history.slice(0, 8);
    render();
    return getPublicState();
  }

  function parseNaturalCommand(rawCommand) {
    const original = compact(rawCommand);
    const command = normalizeCommand(original);
    const zoomIntent = detectZoom(command);
    const mapType = detectMapType(command) || state.mapType;
    const filtersInfo = extractSearchFilters(command);
    const searchable = filtersInfo.command;
    const filters = filtersInfo.filters;

    if (zoomIntent) {
      return { ...state, zoom: clampZoom(state.zoom + zoomIntent.delta), mapType, summary: zoomIntent.label, trace: [["intent", "zoom"], ["delta", String(zoomIntent.delta)]] };
    }

    if (mapType !== state.mapType && /^(航空写真|衛星写真|衛星|satellite|通常地図|標準|道路地図|地図に戻)/i.test(command)) {
      return { ...state, mapType, summary: mapType, trace: [["intent", "map_type"], ["map_type", mapType]] };
    }

    const routeParts = parseRoute(command);
    if (routeParts) {
      const travelMode = detectTravelMode(command) || "driving";
      return {
        intent: "route",
        origin: routeParts.origin,
        destination: routeParts.destination,
        travelMode,
        filters: {},
        zoom: state.zoom,
        mapType,
        summary: `${routeParts.origin} -> ${routeParts.destination}`,
        trace: [["intent", "route"], ["tool", "route_google_maps"], ["origin", routeParts.origin], ["destination", routeParts.destination], ["travel_mode", travelMode]]
      };
    }

    const nearbyBase = parseNearby(searchable);
    const located = parseLocatedSearch(searchable);
    const baseQuery = nearbyBase || located || cleanSearchQuery(searchable) || cleanSearchQuery(command) || original || state.query;
    const query = appendSearchFilters(baseQuery, filters);
    const intent = nearbyBase ? "nearby_search" : "search";
    return {
      intent: "search",
      query,
      filters,
      zoom: nearbyBase ? Math.max(state.zoom, 14) : state.zoom,
      mapType,
      summary: query,
      trace: withFilterTrace([["intent", intent], ["tool", "search_google_maps"], ["query", query]], filters)
    };
  }

  function normalizeCommand(command) {
    return compact(command).replace(/[。、，,！？!?]/g, " ").replace(/\s+/g, " ").trim();
  }

  function compact(value) {
    return String(value || "").replace(/[　]/g, " ").replace(/\s+/g, " ").trim();
  }

  function detectZoom(command) {
    if (/拡大|近づ|ズームイン|zoom in/i.test(command)) return { delta: 2, label: "zoom in" };
    if (/縮小|引い|広域|ズームアウト|zoom out/i.test(command)) return { delta: -2, label: "zoom out" };
    return null;
  }

  function detectMapType(command) {
    if (/航空|衛星|satellite/i.test(command)) return "satellite";
    if (/通常地図|標準|道路地図|roadmap|地図に戻/i.test(command)) return "roadmap";
    return "";
  }

  function detectTravelMode(command) {
    if (/徒歩|歩き|歩いて|\bwalk(?:ing)?\b/i.test(command)) return "walking";
    if (/電車|バス|公共交通|乗換|\btrain\b|\btransit\b/i.test(command)) return "transit";
    if (/自転車|サイクリング|\bbike\b|\bbicycl/i.test(command)) return "bicycling";
    if (/車|クルマ|ドライブ|\bcar\b|\bdriv/i.test(command)) return "driving";
    return "";
  }

  function normalizeTravelMode(mode) {
    const value = compact(mode).toLowerCase();
    return ["walking", "transit", "bicycling", "driving"].includes(value) ? value : detectTravelMode(value) || "driving";
  }

  function parseRoute(command) {
    if (!/から|まで|へ|行き方|ルート|経路|案内|directions|route|from | to |->|→/i.test(command)) return null;
    const english = command.match(/\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s+by\s+.+)?$/i);
    if (english) return { origin: stripRouteNoise(english[1]), destination: stripRouteNoise(english[2]) };
    const arrow = command.match(/(.+?)(?:->|→)(.+)$/);
    if (arrow) return { origin: stripRouteNoise(arrow[1]), destination: stripRouteNoise(arrow[2]) };
    const japanese = command.match(/^(.+?)から(.+?)(?:まで|へ|に)(.*)$/) || command.match(/^(.+?)から(.+)$/);
    if (!japanese) return null;
    const origin = stripRouteNoise(japanese[1]);
    const destination = stripRouteNoise(`${japanese[2]} ${japanese[3] || ""}`);
    return origin && destination && origin !== destination ? { origin, destination } : null;
  }

  function stripRouteNoise(value) {
    return compact(value)
      .replace(/(まで|へ|に|の)?(行き方|ルート|経路|案内|検索|表示|見せて|調べて|お願い|ください)$/g, "")
      .replace(/(徒歩|歩き|歩いて|電車|バス|公共交通|乗換|自転車|車|クルマ|ドライブ)$/g, "")
      .replace(/\b(by|via|with|route|directions|driving|walking|transit|bicycling|car|train|bike)\b.*$/i, "")
      .trim();
  }

  function parseNearby(command) {
    const explicitArea = command.match(/^(.+?)(?:周辺|付近|近く)(?:で|の|にある|\s+)(.+)$/);
    if (explicitArea) return compact(`${cleanSearchQuery(explicitArea[1])} ${cleanSearchQuery(explicitArea[2])}`);
    const currentArea = command.match(/^(?:この周辺|この近く|周辺|近く|近所|nearby|around here)(?:で|の|にある|\s+)?(.+)/i);
    if (!currentArea) return "";
    return compact(`${state.destination || state.query || "現在地"} ${cleanSearchQuery(currentArea[1])}`);
  }

  function parseLocatedSearch(command) {
    const japanese = command.match(/^(.+?)(?:周辺で|付近で|近くで|で)(.+)$/);
    if (japanese) return compact(`${cleanSearchQuery(japanese[1])} ${cleanSearchQuery(japanese[2])}`);
    const english = command.match(/^(.+?)\s+in\s+(.+)$/i);
    if (english) return compact(`${cleanSearchQuery(english[1])} in ${cleanSearchQuery(english[2])}`);
    return "";
  }

  function cleanSearchQuery(value) {
    return compact(value)
      .replace(ratingPattern(), " ")
      .replace(reviewPattern(), " ")
      .replace(/(?:高評価|評価の高い|評判の良い|top rated|best rated)/gi, " ")
      .replace(/^(おすすめの?|人気の?|近くの?|周辺の?)/g, "")
      .replace(/(を)?(検索|探して|表示|開いて|見せて|調べて|お願い|ください|して)$/g, "")
      .replace(/\b(search|show|find|open|please)\b/gi, "")
      .replace(/[。、，,]/g, " ")
      .replace(/^[のなで\s]+|[のなで\s]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractSearchFilters(command) {
    const filters = {};
    let working = command.replace(ratingPattern(), (_match, explicit, loose) => {
      const rating = parseRating(explicit || loose);
      if (rating !== null) filters.ratingMin = rating;
      return " ";
    });
    working = working.replace(reviewPattern(), (_match, explicit, loose) => {
      const count = parseCount(explicit || loose);
      if (count !== null) filters.reviewsMin = count;
      return " ";
    });
    if (/(高評価|評価の高い|評判の良い|top rated|best rated)/i.test(working)) {
      filters.highRated = true;
      working = working.replace(/(?:高評価|評価の高い|評判の良い|top rated|best rated)/gi, " ");
    }
    return { command: cleanSearchQuery(working), filters: normalizeFilters(filters) };
  }

  function ratingPattern() {
    return /(?:評価|星|rating|rated|stars?|review score)(?:が|は|:| of| is| at least)?\s*([0-5](?:[.,]\d)?)\s*(?:以上|超|より上|より高い|over|above|or higher|and up|or more|\+)?|([0-5](?:[.,]\d)?)\s*(?:以上|超|より上|\+)\s*(?:の)?(?:評価|星|star[s]?|rated)?/gi;
  }

  function reviewPattern() {
    return /(?:口コミ|レビュー|review[s]?)(?:数|件数)?(?:が|は|:)?\s*([0-9][0-9,]*)\s*(?:件)?\s*(?:以上|超|より多い|over|above|or more|and up|\+)|([0-9][0-9,]*)\s*(?:件)?\s*(?:以上|超|\+)\s*(?:の)?(?:口コミ|レビュー|review[s]?)/gi;
  }

  function parseRating(value) {
    if (value === undefined || value === null || value === "") return null;
    const rating = Number(String(value).replace(",", "."));
    return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null;
  }

  function parseCount(value) {
    const count = Number.parseInt(String(value || "").replace(/,/g, ""), 10);
    return Number.isFinite(count) && count > 0 ? count : null;
  }

  function normalizeFilters(input) {
    const source = input || {};
    const filters = {};
    const rating = parseRating(source.ratingMin ?? source.minRating);
    const reviews = parseCount(source.reviewsMin ?? source.minReviews);
    if (rating !== null) filters.ratingMin = rating;
    if (reviews !== null) filters.reviewsMin = reviews;
    if (source.highRated) filters.highRated = true;
    return filters;
  }

  function appendSearchFilters(query, filters) {
    return compact([query].concat(filterTerms(filters)).join(" "));
  }

  function filterTerms(filters) {
    const normalized = normalizeFilters(filters);
    const terms = [];
    if (normalized.ratingMin !== undefined) terms.push(`評価${formatRating(normalized.ratingMin)}以上`);
    else if (normalized.highRated) terms.push("高評価");
    if (normalized.reviewsMin !== undefined) terms.push(`口コミ${normalized.reviewsMin}件以上`);
    return terms;
  }

  function withFilterTrace(trace, filters) {
    const normalized = normalizeFilters(filters);
    if (normalized.ratingMin !== undefined) trace.push(["rating_min", formatRating(normalized.ratingMin)]);
    if (normalized.reviewsMin !== undefined) trace.push(["reviews_min", String(normalized.reviewsMin)]);
    if (normalized.highRated) trace.push(["quality_hint", "high rated"]);
    return trace;
  }

  function filterSummary(filters) {
    const terms = filterTerms(filters);
    return terms.length ? terms.join(" / ") : "none";
  }

  function formatRating(value) {
    return Number(value).toFixed(1).replace(/\.0$/, "");
  }

  function buildUrls(nextState) {
    if (nextState.intent === "route") {
      const routeParams = new URLSearchParams({ api: "1", origin: nextState.origin, destination: nextState.destination, travelmode: normalizeTravelMode(nextState.travelMode) });
      const embedParams = new URLSearchParams(routeParams);
      embedParams.set("output", "embed");
      return {
        embedUrl: `https://www.google.com/maps/dir/?${embedParams.toString()}`,
        openUrl: `https://www.google.com/maps/dir/?${routeParams.toString()}`,
        generatedUrl: `https://www.google.com/maps/dir/?${routeParams.toString()}`
      };
    }
    const embedParams = new URLSearchParams({ q: nextState.query, z: String(nextState.zoom), output: "embed" });
    if (nextState.mapType === "satellite") embedParams.set("t", "k");
    const searchParams = new URLSearchParams({ api: "1", query: nextState.query });
    return {
      embedUrl: `https://www.google.com/maps?${embedParams.toString()}`,
      openUrl: `https://www.google.com/maps/search/?${searchParams.toString()}`,
      generatedUrl: `https://www.google.com/maps/search/?${searchParams.toString()}`
    };
  }

  function render() {
    if (els.mapFrame.src !== state.embedUrl) els.mapFrame.src = state.embedUrl;
    els.mapModeLabel.textContent = state.intent === "route" ? "Route" : state.mapType === "satellite" ? "Satellite" : "Search";
    els.intentValue.textContent = state.intent;
    els.targetValue.textContent = getTargetLabel();
    els.zoomValue.textContent = String(state.zoom);
    els.travelValue.textContent = state.travelMode;
    els.conditionsValue.textContent = filterSummary(state.filters);
    els.generatedUrl.textContent = state.generatedUrl;
    els.generatedUrl.href = state.generatedUrl;
    renderList(els.traceList, state.trace.map(([key, value]) => ({ title: key, text: value || "-" })));
    renderList(els.historyList, state.history.map((item) => ({ title: item.summary, text: `${item.timestamp} / ${item.source} / ${item.intent}` })));
  }

  function renderList(element, items) {
    element.replaceChildren();
    items.forEach((item) => {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = item.title;
      span.textContent = item.text;
      li.append(strong, span);
      element.appendChild(li);
    });
  }

  function getTargetLabel() {
    return state.intent === "route" ? `${state.origin} -> ${state.destination}` : state.query;
  }

  function setWebMCPStatus(status, isReady) {
    els.webmcpStatus.textContent = status;
    els.webmcpStatus.classList.toggle("ready", Boolean(isReady));
  }

  function clampZoom(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(21, Math.max(3, Math.round(numeric))) : state.zoom || 14;
  }

  function getPublicState() {
    return {
      intent: state.intent,
      query: state.query,
      origin: state.origin,
      destination: state.destination,
      travelMode: state.travelMode,
      zoom: state.zoom,
      mapType: state.mapType,
      filters: { ...state.filters },
      conditions: filterSummary(state.filters),
      embedUrl: state.embedUrl,
      openUrl: state.openUrl,
      generatedUrl: state.generatedUrl,
      target: getTargetLabel(),
      trace: state.trace.slice()
    };
  }
})();
