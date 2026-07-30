const API_BASE = "https://api.balldontlie.io/v1";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class ProviderCapabilityError extends Error {
  constructor(message, status) { super(message); this.name = "ProviderCapabilityError"; this.status = status; }
}

export function createBalldontlieClient({
  apiKey,
  fetchImpl = fetch,
  maxRetries = 5,
  minimumIntervalMs = 1050,
  requestTimeoutMs = 20_000,
  logger = () => {},
}) {
  if (!apiKey) throw new Error("BALLDONTLIE_API_KEY is not configured.");
  let lastRequestAt = 0;
  async function request(path, params = {}) {
    const url = new URL(`${API_BASE}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(`${key}[]`, String(item)));
      else url.searchParams.set(key, String(value));
    });
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const delay = minimumIntervalMs - (Date.now() - lastRequestAt);
      if (delay > 0) await wait(delay);
      lastRequestAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response;
      try {
        response = await fetchImpl(url, {
          headers: { Authorization: apiKey, Accept: "application/json" },
          signal: controller.signal,
        });
        if (response.ok) return await response.json();
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error(`BALLDONTLIE ${path} timed out after ${requestTimeoutMs}ms.`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      if ([401, 403, 404].includes(response.status)) throw new ProviderCapabilityError(`Provider access unavailable for ${path}.`, response.status);
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const retryHeader = response.headers.get("retry-after");
        const retrySeconds = retryHeader === null ? Number.NaN : Number(retryHeader);
        const retryMs = Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 500 * (2 ** attempt);
        logger(`BALLDONTLIE returned HTTP ${response.status}; retrying in ${Math.ceil(retryMs / 1000)}s (${attempt + 1}/${maxRetries}).`);
        await wait(retryMs);
        continue;
      }
      throw new Error(`BALLDONTLIE ${path} failed with HTTP ${response.status}.`);
    }
  }
  return { request };
}

export async function fetchAllCursorPages(fetchPage, { logger = () => {}, maxPages = 1_000, label = "player" } = {}) {
  const rows = [];
  const ids = new Set();
  const seenCursors = new Set();
  let cursor;
  for (let page = 1; page <= maxPages; page += 1) {
    const cursorKey = cursor === undefined ? "__first_page__" : String(cursor);
    if (seenCursors.has(cursorKey)) throw new Error(`Provider pagination repeated cursor ${cursorKey} on page ${page}.`);
    seenCursors.add(cursorKey);
    logger(`Fetching ${label} page ${page}...`);
    const response = await fetchPage(cursor);
    if (!Array.isArray(response?.data)) throw new Error("Provider response is missing a data array.");
    logger(`Fetched ${response.data.length} players (page ${page}; ${rows.length + response.data.length} received so far).`);
    response.data.forEach((row) => { if (!ids.has(row.id)) { ids.add(row.id); rows.push(row); } });
    if (response.data.length === 0) {
      logger("Provider returned an empty page; pagination complete.");
      return rows;
    }
    const nextCursor = response.meta?.next_cursor ?? null;
    if (nextCursor === null || nextCursor === undefined || nextCursor === "") return rows;
    if (seenCursors.has(String(nextCursor))) throw new Error(`Provider pagination returned duplicate next_cursor ${nextCursor}.`);
    cursor = nextCursor;
  }
  throw new Error(`Provider pagination exceeded the ${maxPages}-page safety limit.`);
}

export async function loadProviderDirectory(client, { preferActive = true, logger = () => {}, maxPages = 1_000 } = {}) {
  if (preferActive) {
    try {
      logger("Checking the provider active-player directory...");
      const players = await fetchAllCursorPages((cursor) => client.request("/players/active", { per_page: 100, cursor }), { logger, maxPages, label: "active-player" });
      return { players, activeIds: new Set(players.map((player) => player.id)), activeMode: "provider-active" };
    } catch (error) {
      if (!(error instanceof ProviderCapabilityError)) throw error;
      logger("The active Players endpoint is unavailable for this API tier; using the full Players directory with an approximate current-player filter.");
    }
  }
  const directory = await fetchAllCursorPages((cursor) => client.request("/players", { per_page: 100, cursor, team_ids: Array.from({ length: 30 }, (_, index) => index + 1) }), { logger, maxPages, label: "player" });
  return {
    players: directory,
    activeIds: null,
    activeMode: "season-appearance-allowlist",
    totalDirectoryPlayers: directory.length,
  };
}

export async function probeProviderCapabilities(client) {
  const result = { players: false, activePlayers: false, enrichedStats: false };
  await client.request("/players", { per_page: 1 }); result.players = true;
  for (const [key, path] of [["activePlayers", "/players/active"], ["enrichedStats", "/stats"]]) {
    try { await client.request(path, { per_page: 1 }); result[key] = true; } catch (error) { if (!(error instanceof ProviderCapabilityError)) throw error; }
  }
  return result;
}
