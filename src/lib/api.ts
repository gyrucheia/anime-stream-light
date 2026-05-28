export const API_BASE = "https://anime-api-s52u.onrender.com";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`API ${path} failed: ${r.status}`);
  return r.json();
}

export type AnimeItem = {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; extraLarge?: string; color?: string };
  bannerImage?: string | null;
  description?: string;
  genres?: string[];
  episodes?: number | null;
  averageScore?: number | null;
  seasonYear?: number | null;
  format?: string | null;
  status?: string | null;
};

export type Stream = {
  url: string;
  type: string;
  referer: string;
  server: string;
  default?: boolean;
};

export type EpisodeMeta = {
  id: string;
  number: number;
  title?: string;
  duration?: number;
  description?: string;
  image?: string;
  filler?: boolean;
};

export const titleOf = (a: { title: AnimeItem["title"] }) =>
  a.title?.english || a.title?.romaji || a.title?.native || "Untitled";

export const posterOf = (a: AnimeItem) =>
  a.coverImage?.extraLarge || a.coverImage?.large || "";

export const stripHtml = (s?: string) =>
  (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

export const api = {
  trending: (page = 1, perPage = 24) =>
    get<{ results: AnimeItem[] }>(`/anime/trending?page=${page}&per_page=${perPage}`),
  spotlight: () => get<{ results: AnimeItem[] }>(`/anime/spotlight`),
  popular: (page = 1, perPage = 24) =>
    get<{ results: AnimeItem[] }>(`/anime/popular?page=${page}&per_page=${perPage}`),
  search: (q: string, page = 1) =>
    get<{ results: AnimeItem[] }>(
      `/anime/search?query=${encodeURIComponent(q)}&page=${page}&per_page=24`,
    ),
  info: (id: number | string) => get<AnimeItem>(`/anime/info/${id}`),
  episodes: (id: number | string) =>
    get<{
      providers: Record<
        string,
        { meta?: any; episodes?: { sub?: EpisodeMeta[]; dub?: EpisodeMeta[] } }
      >;
    }>(`/anime/episodes/${id}`),
  extract: (id: number | string, e: number) =>
    get<{ streams: Stream[] }>(`/anime/extract/${id}?e=${e}`),
};

export const proxiedM3U8 = (url: string, referer: string) =>
  `${API_BASE}/proxy_m3u8?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
