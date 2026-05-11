const STREMIO_API = "https://api.strem.io/api";
const CINEMETA_URL = "https://v3-cinemeta.strem.io";
const TORRENTIO_URL = "https://torrentio.strem.fun";

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
    resources?: string[];
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
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
  };
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

export async function fetchCatalog(
  type: "movie" | "series",
  extra?: { search?: string; genre?: string; skip?: number }
): Promise<StremioMeta[]> {
  let url = `${CINEMETA_URL}/catalog/${type}/top`;
  const params: string[] = [];
  if (extra?.search) params.push(`search=${encodeURIComponent(extra.search)}`);
  if (extra?.genre) params.push(`genre=${encodeURIComponent(extra.genre)}`);
  if (extra?.skip) params.push(`skip=${extra.skip}`);
  if (params.length > 0) url += `/${params.join("&")}.json`;
  else url += ".json";

  const res = await fetchWithTimeout(url, {}, 12000);
  if (!res.ok) throw new Error(`Failed to fetch ${type} catalog`);
  const data = await res.json();
  return (data.metas ?? []) as StremioMeta[];
}

export async function fetchMeta(type: string, id: string): Promise<StremioMeta | null> {
  const res = await fetchWithTimeout(`${CINEMETA_URL}/meta/${type}/${id}.json`, {}, 10000);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.meta ?? null) as StremioMeta | null;
}

export async function fetchStreams(
  type: string,
  id: string,
  addons?: StremioAddon[]
): Promise<StremioStream[]> {
  const streamPromises: Promise<StremioStream[]>[] = [];

  streamPromises.push(
    fetchWithTimeout(`${TORRENTIO_URL}/stream/${type}/${id}.json`, {}, 8000)
      .then((res) => (res.ok ? res.json() : { streams: [] }))
      .then((data) => (data.streams ?? []) as StremioStream[])
      .catch(() => [] as StremioStream[])
  );

  if (addons && addons.length > 0) {
    for (const addon of addons) {
      const resources = addon.manifest?.resources ?? [];
      const supportsStream = resources.some((r: unknown) => {
        if (typeof r === "string") return r === "stream";
        if (typeof r === "object" && r !== null && "name" in r) {
          return (r as { name: string }).name === "stream";
        }
        return false;
      });
      if (!supportsStream) continue;
      const types = addon.manifest?.types ?? [];
      if (!types.includes(type)) continue;

      const baseUrl = addon.transportUrl.replace(/\/manifest\.json$/, "");
      streamPromises.push(
        fetchWithTimeout(`${baseUrl}/stream/${type}/${id}.json`, {}, 8000)
          .then((res) => (res.ok ? res.json() : { streams: [] }))
          .then((data) => (data?.streams ?? []) as StremioStream[])
          .catch(() => [] as StremioStream[])
      );
    }
  }

  const results = await Promise.allSettled(streamPromises);
  const all: StremioStream[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all;
}
