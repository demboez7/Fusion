const STREMIO_API = "https://api.strem.io/api";
const CINEMETA_URL = "https://v3-cinemeta.strem.io";
const TORRENTIO_URL = "https://torrentio.strem.fun";

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
  subtitles?: { id: string; url: string; lang: string }[];
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
  const res = await fetch(`${STREMIO_API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "Login", email, password }),
  });
  if (!res.ok) throw new Error("Login request failed");
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { authKey: data.result.authKey, user: data.result.user };
}

export async function getUserAddons(authKey: string): Promise<StremioAddon[]> {
  const res = await fetch(`${STREMIO_API}/addonCollectionGet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "AddonCollectionGet", authKey }),
  });
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

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${type} catalog`);
  const data = await res.json();
  return (data.metas ?? []) as StremioMeta[];
}

export async function fetchMeta(type: string, id: string): Promise<StremioMeta | null> {
  const res = await fetch(`${CINEMETA_URL}/meta/${type}/${id}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.meta ?? null) as StremioMeta | null;
}

export async function fetchStreams(
  type: string,
  id: string,
  addons?: StremioAddon[]
): Promise<StremioStream[]> {
  const streams: StremioStream[] = [];

  const torrentioRes = await fetch(`${TORRENTIO_URL}/stream/${type}/${id}.json`).catch(() => null);
  if (torrentioRes?.ok) {
    const data = await torrentioRes.json();
    if (data.streams) streams.push(...(data.streams as StremioStream[]));
  }

  if (addons && addons.length > 0) {
    for (const addon of addons) {
      const resources = addon.manifest?.resources ?? [];
      const supportsStream =
        resources.includes("stream") ||
        resources.some((r: unknown) => (typeof r === "object" && r !== null && "name" in r ? (r as { name: string }).name : r) === "stream");
      if (!supportsStream) continue;
      const types = addon.manifest?.types ?? [];
      if (!types.includes(type)) continue;

      const baseUrl = addon.transportUrl.replace(/\/manifest\.json$/, "");
      const addonRes = await fetch(`${baseUrl}/stream/${type}/${id}.json`).catch(() => null);
      if (addonRes?.ok) {
        const data = await addonRes.json().catch(() => null);
        if (data?.streams) streams.push(...(data.streams as StremioStream[]));
      }
    }
  }

  return streams;
}

export async function fetchAddonCatalog(
  addon: StremioAddon,
  type: string,
  catalogId: string,
  extra?: Record<string, string>
): Promise<StremioMeta[]> {
  const baseUrl = addon.transportUrl.replace(/\/manifest\.json$/, "");
  let url = `${baseUrl}/catalog/${type}/${catalogId}`;
  if (extra && Object.keys(extra).length > 0) {
    const parts = Object.entries(extra).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    url += `/${parts.join("&")}`;
  }
  url += ".json";
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return [];
  const data = await res.json().catch(() => null);
  return (data?.metas ?? []) as StremioMeta[];
}
