const STREMIO_API = "https://api.strem.io/api";
const CINEMETA_URL = "https://v3-cinemeta.strem.io";

// Many Stremio addons (Real-Debrid variants like Torrentio, Comet,
// Jackettio, Peerflix, Sootio, etc.) filter incoming requests by
// User-Agent / Origin / Referer and silently return an empty stream
// array unless the request looks like it came from the official
// Stremio desktop or web client. We mimic the desktop Electron shell
// UA + the web client's Origin/Referer.
const STREMIO_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) stremio-shell/4.4.168 Chrome/106.0.5249.199 Electron/21.4.0 Safari/537.36";

function addonHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": STREMIO_UA,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
    Origin: "https://web.stremio.com",
    Referer: "https://web.stremio.com/",
    ...(extra ?? {}),
  };
}

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchAddon(url: string, timeoutMs = 10000): Promise<Response> {
  return fetchWithTimeout(url, { headers: addonHeaders() }, timeoutMs);
}

export interface StremioUser {
  _id: string;
  email: string;
  fullname?: string;
  avatar?: string;
}

export interface StremioAddon {
  transportUrl: string;
  transportName: string;
  manifest: {
    id: string;
    name: string;
    version: string;
    catalogs?: AddonCatalog[];
    resources?: unknown[];
    types?: string[];
  };
}

export interface AddonCatalog {
  type: string;
  id: string;
  name?: string;
  extra?: { name: string; isRequired?: boolean; options?: string[] }[];
}

export interface StremioMeta {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  runtime?: string;
  genres?: string[];
  year?: number;
  videos?: StremioVideo[];
  // Cinemeta and most catalog addons include the IMDB id alongside their
  // own catalog id. Used so debrid addons (Torrentio, Comet, Jackettio,
  // etc.) — which only key on tt… ids — can still find streams when the
  // primary id is from a different catalog (mf:…, kitsu:…, etc.).
  imdb_id?: string;
}

export interface StremioVideo {
  id: string;
  title?: string;
  name?: string;
  season?: number;
  episode?: number;
  released?: string;
  thumbnail?: string;
  overview?: string;
}

export interface StremioStream {
  name?: string;
  title?: string;
  url?: string;
  infoHash?: string;
  sources?: string[];
  subtitles?: StremioSubtitle[];
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
  };
}

export interface StremioSubtitle {
  id: string;
  url: string;
  lang: string;
  // Some addons include extra metadata in the subtitle object — keep them
  // optional so we can display nicer labels when available.
  name?: string;
  title?: string;
  m?: string;
  SubFormat?: string;
  // Stamped by fetchSubtitlesFromAddons so the player can show which
  // addon each entry came from.
  addonName?: string;
}

export interface AddonStreamProgress {
  addonId: string;
  addonName: string;
  status: "loading" | "done" | "error" | "timeout";
  streams: StremioStream[];
  durationMs: number;
  httpStatus?: number;
  errorMessage?: string;
  // Diagnostic info: the addon's transport URL prefix (with secrets
  // redacted) and the actual /stream/... URL(s) we hit. Used by the
  // detail screen to show users why a given addon returned no streams.
  transportUrl?: string;
  requestUrls?: string[];
  responseSnippet?: string;
}

// Mask credentials embedded in addon URLs so they can be safely shown in
// the diagnostic UI. Covers two patterns:
//   1. "key=TOKEN" style query/path segments (Torrentio, Peerflix, etc.)
//   2. URL-encoded JSON config blobs that include "apiKey":"TOKEN" or
//      base64-packed config segments (Sootio, TorrentsDB, Jackettio).
// Any standalone alphanumeric run of 20+ characters is replaced with ***
// — long enough to avoid masking domain segments / words but short enough
// to catch real RD / AD / Premiumize keys.
export function redactAddonUrl(url: string): string {
  return url
    .replace(/=([A-Za-z0-9]{12,})/g, "=***")
    .replace(/[A-Za-z0-9]{20,}/g, "***");
}

export interface LoginResult {
  authKey: string;
  user: StremioUser;
}

export async function stremioLogin(email: string, password: string): Promise<LoginResult> {
  const res = await fetchWithTimeout(`${STREMIO_API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "Login", email, password }),
  }, 12000);
  if (!res.ok) throw new Error("Login request failed");
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { authKey: data.result.authKey, user: data.result.user };
}

export async function getUserAddons(authKey: string): Promise<StremioAddon[]> {
  const res = await fetchWithTimeout(`${STREMIO_API}/addonCollectionGet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "AddonCollectionGet", authKey }),
  }, 12000);
  if (!res.ok) throw new Error("Failed to fetch addons");
  const data = await res.json();
  return (data.result?.addons ?? []) as StremioAddon[];
}

export function addonSupportsResource(addon: StremioAddon, resource: string): boolean {
  return (addon.manifest?.resources ?? []).some((r: unknown) => {
    if (typeof r === "string") return r === resource;
    if (typeof r === "object" && r !== null && "name" in r) {
      return (r as { name: string }).name === resource;
    }
    return false;
  });
}

function buildCatalogUrl(baseUrl: string, type: string, catalogId: string, extra?: { search?: string; skip?: number }): string {
  const params: string[] = [];
  if (extra?.search) params.push(`search=${encodeURIComponent(extra.search)}`);
  if (extra?.skip && extra.skip > 0) params.push(`skip=${extra.skip}`);
  let url = `${baseUrl}/catalog/${type}/${catalogId}`;
  if (params.length > 0) url += `/${params.join("&")}.json`;
  else url += ".json";
  return url;
}

export async function fetchCatalog(
  type: "movie" | "series",
  extra?: { search?: string; genre?: string; skip?: number }
): Promise<StremioMeta[]> {
  const url = buildCatalogUrl(CINEMETA_URL, type, "top", extra);
  const res = await fetchWithTimeout(url, {}, 12000);
  if (!res.ok) throw new Error(`Failed to fetch ${type} catalog`);
  const data = await res.json();
  return (data.metas ?? []) as StremioMeta[];
}

export async function fetchCatalogFromAddons(
  type: "movie" | "series",
  addons: StremioAddon[],
  extra?: { search?: string; skip?: number }
): Promise<StremioMeta[]> {
  const catalogPromises: Promise<StremioMeta[]>[] = [];

  for (const addon of addons) {
    const catalogs = (addon.manifest?.catalogs ?? []).filter((c) => c.type === type);
    for (const catalog of catalogs) {
      const baseUrl = addon.transportUrl.replace(/\/manifest\.json$/, "");
      const catalogExtras = catalog.extra ?? [];

      if (extra?.search) {
        const supportsSearch = catalogExtras.some((e) => e.name === "search");
        if (!supportsSearch) continue;
      }

      const url = buildCatalogUrl(baseUrl, type, catalog.id, extra);
      catalogPromises.push(
        fetchWithTimeout(url, {}, 10000)
          .then((res) => (res.ok ? res.json() : { metas: [] }))
          .then((data) => (data.metas ?? []) as StremioMeta[])
          .catch(() => [] as StremioMeta[])
      );
    }
  }

  if (catalogPromises.length === 0) return [];

  const results = await Promise.allSettled(catalogPromises);
  const all: StremioMeta[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const item of r.value) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          all.push(item);
        }
      }
    }
  }
  return all;
}

export interface CatalogRow {
  key: string;
  addonId: string;
  addonName: string;
  catalogId: string;
  catalogName: string;
  type: string;
  items: StremioMeta[];
}

export async function fetchCatalogRows(
  addons: StremioAddon[],
  types: string[] = ["movie", "series", "anime"],
  perCatalogLimit = 20
): Promise<CatalogRow[]> {
  type Job = {
    key: string;
    addonId: string;
    addonName: string;
    catalogId: string;
    catalogName: string;
    type: string;
    promise: Promise<StremioMeta[]>;
  };
  const jobs: Job[] = [];

  for (const addon of addons) {
    const addonId = addon.manifest?.id ?? addon.transportUrl;
    const addonName = addon.manifest?.name ?? "Addon";
    const baseUrl = addon.transportUrl.replace(/\/manifest\.json$/, "");
    const catalogs = (addon.manifest?.catalogs ?? []).filter((c) => types.includes(c.type));

    for (const catalog of catalogs) {
      const catalogExtras = catalog.extra ?? [];
      const requiredExtras = catalogExtras.filter((e) => e.isRequired);
      // Skip catalogs that need user-supplied required filters (search, genre, etc.) — they'd return empty.
      if (requiredExtras.some((e) => e.name !== "skip")) continue;

      const url = buildCatalogUrl(baseUrl, catalog.type, catalog.id);
      jobs.push({
        key: `${addonId}::${catalog.type}::${catalog.id}`,
        addonId,
        addonName,
        catalogId: catalog.id,
        catalogName: catalog.name ?? catalog.id,
        type: catalog.type,
        promise: fetchWithTimeout(url, {}, 10000)
          .then((res) => (res.ok ? res.json() : { metas: [] }))
          .then((data) => ((data.metas ?? []) as StremioMeta[]).slice(0, perCatalogLimit))
          .catch(() => [] as StremioMeta[]),
      });
    }
  }

  const settled = await Promise.allSettled(jobs.map((j) => j.promise));
  const rows: CatalogRow[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    const r = settled[i];
    const items = r.status === "fulfilled" ? r.value : [];
    if (items.length === 0) continue;
    rows.push({
      key: j.key,
      addonId: j.addonId,
      addonName: j.addonName,
      catalogId: j.catalogId,
      catalogName: j.catalogName,
      type: j.type,
      items,
    });
  }
  return rows;
}

export async function fetchMeta(type: string, id: string): Promise<StremioMeta | null> {
  const res = await fetchWithTimeout(`${CINEMETA_URL}/meta/${type}/${id}.json`, {}, 10000);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.meta ?? null) as StremioMeta | null;
}

export async function fetchMetaFromAddons(
  type: string,
  id: string,
  addons: StremioAddon[]
): Promise<StremioMeta | null> {
  const metaAddons = addons.filter(
    (a) => addonSupportsResource(a, "meta") && (a.manifest?.types ?? []).includes(type)
  );
  for (const addon of metaAddons) {
    try {
      const baseUrl = addon.transportUrl.replace(/\/manifest\.json$/, "");
      const res = await fetchAddon(`${baseUrl}/meta/${type}/${id}.json`, 8000);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.meta) return data.meta as StremioMeta;
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchSubtitlesFromAddons(
  type: string,
  id: string,
  addons: StremioAddon[]
): Promise<StremioSubtitle[]> {
  const subAddons = addons.filter((a) => addonSupportsResource(a, "subtitles"));
  if (subAddons.length === 0) return [];

  const results = await Promise.allSettled(
    subAddons.map((addon) => {
      const baseUrl = addon.transportUrl.replace(/\/manifest\.json$/, "");
      const addonName = addon.manifest?.name ?? "Addon";
      return fetchAddon(`${baseUrl}/subtitles/${type}/${id}.json`, 10000)
        .then((res) => (res.ok ? res.json() : { subtitles: [] }))
        .then(
          (data) =>
            ((data?.subtitles ?? []) as StremioSubtitle[]).map((s) => ({
              ...s,
              addonName,
            }))
        )
        .catch(() => [] as StremioSubtitle[]);
    })
  );

  const all: StremioSubtitle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all;
}

// Build the candidate id list to try for each addon. When the primary id
// is something like "mf:abc" or "kitsu:123" but we also know the IMDB id
// (from meta.imdb_id), we try both — most debrid addons only respond to
// tt… ids, so this is what unlocks Torrentio/Comet/Jackettio/etc. for
// non-IMDB-catalog titles. For series the imdb id needs the season and
// episode appended.
function buildIdCandidates(primaryId: string, imdbId?: string): string[] {
  const out: string[] = [primaryId];
  if (!imdbId) return out;
  // Already an IMDB id? nothing to add.
  const head = primaryId.split(":")[0];
  if (head.startsWith("tt") || primaryId === imdbId) return out;
  // Trust the caller to pass a well-formed imdbId. For movies it should
  // be "tt12345"; for series episodes it should already include the
  // ":S:E" tail (e.g. "tt12345:1:5"). Do NOT try to graft the primary
  // id's tail onto the imdb id here — primary ids of the form
  // "tmdb:67890" have a tail that is the TMDB number, not a S:E pair,
  // and concatenating it produces invalid ids that addons reject.
  if (!out.includes(imdbId)) out.push(imdbId);
  return out;
}

export function fetchStreamsProgressive(
  type: string,
  id: string,
  addons: StremioAddon[],
  onAddon: (progress: AddonStreamProgress) => void,
  perAddonTimeoutMs = 30000,
  imdbId?: string
): Promise<void> {
  const candidates = buildIdCandidates(id, imdbId);
  const tasks: Promise<void>[] = [];
  for (const addon of addons) {
    if (!addonSupportsResource(addon, "stream")) continue;
    const types = addon.manifest?.types ?? [];
    if (!types.includes(type)) continue;

    const addonId = addon.manifest?.id ?? addon.transportUrl;
    const addonName = addon.manifest?.name ?? "Addon";
    const baseUrl = addon.transportUrl.replace(/\/manifest\.json$/, "");
    const startedAt = Date.now();

    onAddon({ addonId, addonName, status: "loading", streams: [], durationMs: 0 });

    // Pick which candidate ids to try for this addon. If the manifest
    // declares idPrefixes, only call ids matching one of them. Otherwise
    // try every candidate.
    const idPrefixes: string[] = (addon.manifest as { idPrefixes?: string[] } | undefined)?.idPrefixes ?? [];
    const filtered = candidates.filter((cid) => {
      if (idPrefixes.length === 0) return true;
      return idPrefixes.some((p) => cid.startsWith(p));
    });
    const idsToTry = filtered.length > 0 ? filtered : candidates;

    interface PerIdResult {
      streams: StremioStream[];
      httpStatus?: number;
      ok: boolean;
      timedOut: boolean;
      errorMessage?: string;
      requestUrl: string;
      responseSnippet?: string;
    }

    const runOne = (tryId: string): Promise<PerIdResult> => {
      const reqUrl = `${baseUrl}/stream/${type}/${tryId}.json`;
      return fetchAddon(reqUrl, perAddonTimeoutMs)
        .then(async (res): Promise<PerIdResult> => {
          const httpStatus = res.status;
          if (!res.ok) {
            let snippet = "";
            try {
              snippet = (await res.text()).slice(0, 200);
            } catch {
              // ignore
            }
            // eslint-disable-next-line no-console
            console.warn(
              `[stremio] ${addonName} ${reqUrl} -> HTTP ${httpStatus}${snippet ? ` body: ${snippet}` : ""}`
            );
            return {
              streams: [],
              httpStatus,
              ok: false,
              timedOut: false,
              errorMessage: `HTTP ${httpStatus}`,
              requestUrl: reqUrl,
              responseSnippet: snippet,
            };
          }
          let data: { streams?: StremioStream[] } = {};
          let rawText = "";
          try {
            rawText = await res.text();
            data = rawText ? JSON.parse(rawText) : {};
          } catch (e) {
            const msg = e instanceof Error ? e.message : "invalid JSON";
            // eslint-disable-next-line no-console
            console.warn(`[stremio] ${addonName} ${reqUrl} -> parse error: ${msg}`);
            return {
              streams: [],
              httpStatus,
              ok: false,
              timedOut: false,
              errorMessage: "bad response",
              requestUrl: reqUrl,
              responseSnippet: rawText.slice(0, 200),
            };
          }
          const streams = (data?.streams ?? []) as StremioStream[];
          // eslint-disable-next-line no-console
          console.log(`[stremio] ${addonName} ${reqUrl} -> 200 OK with ${streams.length} streams`);
          return {
            streams,
            httpStatus,
            ok: true,
            timedOut: false,
            requestUrl: reqUrl,
            responseSnippet: streams.length === 0 ? rawText.slice(0, 200) : undefined,
          };
        })
        .catch((err: unknown): PerIdResult => {
          const aborted =
            err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError";
          const message =
            err && typeof err === "object" && "message" in err
              ? String((err as { message: unknown }).message)
              : "network error";
          // eslint-disable-next-line no-console
          console.warn(`[stremio] ${addonName} ${reqUrl} -> ${aborted ? "timeout" : message}`);
          return {
            streams: [],
            ok: false,
            timedOut: !!aborted,
            errorMessage: aborted ? "timeout" : message,
            requestUrl: reqUrl,
          };
        });
    };

    const task = Promise.all(idsToTry.map(runOne)).then((results) => {
      // Merge streams across candidate ids, deduped by url or infoHash.
      const seen = new Set<string>();
      const merged: StremioStream[] = [];
      for (const r of results) {
        for (const s of r.streams) {
          const key = s.url ?? (s.infoHash ? `ih:${s.infoHash}` : `${s.name}|${s.title}`);
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(s);
        }
      }
      const anyOk = results.some((r) => r.ok);
      const anyTimeout = results.some((r) => r.timedOut);
      const errResult = results.find((r) => !r.ok && !r.timedOut);
      const status: AddonStreamProgress["status"] = anyOk
        ? "done"
        : anyTimeout
          ? "timeout"
          : "error";
      const httpStatus = results.find((r) => r.httpStatus !== undefined)?.httpStatus;
      const errorMessage =
        status === "done" ? undefined : errResult?.errorMessage ?? (anyTimeout ? "timeout" : "failed");
      const responseSnippet = results.find((r) => r.responseSnippet)?.responseSnippet;
      onAddon({
        addonId,
        addonName,
        status,
        streams: merged,
        durationMs: Date.now() - startedAt,
        httpStatus,
        errorMessage,
        transportUrl: redactAddonUrl(addon.transportUrl),
        requestUrls: results.map((r) => redactAddonUrl(r.requestUrl)),
        responseSnippet,
      });
    });
    tasks.push(task);
  }
  return Promise.all(tasks).then(() => undefined);
}

export async function fetchStreams(
  type: string,
  id: string,
  addons?: StremioAddon[]
): Promise<StremioStream[]> {
  if (!addons || addons.length === 0) return [];

  const streamPromises: Promise<StremioStream[]>[] = [];

  for (const addon of addons) {
    if (!addonSupportsResource(addon, "stream")) continue;
    const types = addon.manifest?.types ?? [];
    if (!types.includes(type)) continue;

    const baseUrl = addon.transportUrl.replace(/\/manifest\.json$/, "");
    streamPromises.push(
      fetchWithTimeout(`${baseUrl}/stream/${type}/${id}.json`, {}, 30000)
        .then((res) => (res.ok ? res.json() : { streams: [] }))
        .then((data) => (data?.streams ?? []) as StremioStream[])
        .catch(() => [] as StremioStream[])
    );
  }

  if (streamPromises.length === 0) return [];

  const results = await Promise.allSettled(streamPromises);
  const all: StremioStream[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all;
}
