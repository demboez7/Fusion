const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

function getApiKey(): string | null {
  return (
    (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_TMDB_API_KEY) ||
    null
  );
}

export function tmdbEnabled(): boolean {
  return !!getApiKey();
}

async function tmdbFetch(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const key = getApiKey();
  if (!key) throw new Error("TMDB API key not configured");
  const q = new URLSearchParams({ api_key: key, ...params }).toString();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${TMDB_BASE}${path}?${q}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(id);
  }
}

export interface TmdbShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  number_of_seasons: number;
  genres: { id: number; name: string }[];
  seasons: TmdbSeasonMeta[];
}

export interface TmdbSeasonMeta {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
}

export interface TmdbSeason {
  id: number;
  name: string;
  season_number: number;
  episodes: TmdbEpisode[];
}

export interface TmdbEpisode {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  vote_average: number;
  runtime: number | null;
}

export async function findTmdbIdFromImdb(imdbId: string): Promise<number | null> {
  try {
    const data = await tmdbFetch(`/find/${imdbId}`, { external_source: "imdb_id" }) as {
      tv_results?: { id: number }[];
      movie_results?: { id: number }[];
    };
    return data.tv_results?.[0]?.id ?? data.movie_results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function getTmdbShow(tmdbId: number): Promise<TmdbShow | null> {
  try {
    return (await tmdbFetch(`/tv/${tmdbId}`)) as TmdbShow;
  } catch {
    return null;
  }
}

export async function getTmdbSeason(tmdbId: number, seasonNum: number): Promise<TmdbSeason | null> {
  try {
    return (await tmdbFetch(`/tv/${tmdbId}/season/${seasonNum}`)) as TmdbSeason;
  } catch {
    return null;
  }
}

export function tmdbPoster(path: string | null, size: "w185" | "w342" | "w500" | "w780" = "w342"): string | undefined {
  if (!path) return undefined;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function tmdbBackdrop(path: string | null): string | undefined {
  if (!path) return undefined;
  return `${TMDB_IMAGE_BASE}/w1280${path}`;
}
