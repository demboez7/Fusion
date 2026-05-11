const STREMIO_API = "https://api.strem.io/api";
const CINEMETA_URL = "https://v3-cinemeta.strem.io";

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
      const res = await fetchWithTimeout(`${baseUrl}/meta/${type}/${id}.json`, {}, 8000);
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
      return fetchWithTimeout(`${baseUrl}/subtitles/${type}/${id}.json`, {}, 10000)
        .then((res) => (res.ok ? res.json() : { subtitles: [] }))
        .then((data) => (data?.subtitles ?? []) as StremioSubtitle[])
        .catch(() => [] as StremioSubtitle[]);
    })
  );

  const all: StremioSubtitle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all;
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
      fetchWithTimeout(`${baseUrl}/stream/${type}/${id}.json`, {}, 10000)
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
