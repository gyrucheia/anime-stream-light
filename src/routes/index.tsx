import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { AnimeCard } from "@/components/AnimeCard";
import { api, AnimeItem, posterOf, stripHtml, titleOf } from "@/lib/api";
import { z } from "zod";
import { Play, Compass, TrendingUp, HardDriveDownload, AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import { useWatchHistory, useBackgroundDownloads } from "@/lib/app-context";
import { useState, useEffect, useRef } from "react";
import { getSegmentBlob, getEpisodeMeta } from "@/lib/offline-db";
import Hls from "hls.js";

const searchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gyrucheia — Private anime library" },
      {
        name: "description",
        content:
          "Your private, minimalist anime streaming experience. Search, watch, and download episodes.",
      },
    ],
  }),
  validateSearch: searchSchema,
  component: Home,
});

function Home() {
  const { q } = Route.useSearch();
  const query = (q ?? "").trim();

  const [activeTab, setActiveTab] = useState<"discover" | "top" | "offline">("discover");
  const [isOffline, setIsOffline] = useState(false);
  const [playingOfflineEpisode, setPlayingOfflineEpisode] = useState<any | null>(null);

  const { activeDownloads, removeDownloadedEpisode } = useBackgroundDownloads();
  const completedDownloads = Object.values(activeDownloads).filter((d) => d.status === "completed");
  const completedCount = completedDownloads.length;


  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: () => api.trending(1, 24),
    enabled: activeTab === "discover" && !query && !isOffline,
    staleTime: 5 * 60_000,
  });

  const spotlight = useQuery({
    queryKey: ["spotlight"],
    queryFn: () => api.spotlight(),
    enabled: activeTab === "discover" && !query && !isOffline,
    staleTime: 5 * 60_000,
  });

  const popular = useQuery({
    queryKey: ["popular"],
    queryFn: () => api.popular(1, 24),
    enabled: activeTab === "top" && !query && !isOffline,
    staleTime: 5 * 60_000,
  });

  const search = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.search(query, 1),
    enabled: !!query && !isOffline,
  });

  // Watch for online/offline events to automatically switch interface mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      const handleOnline = () => {
        setIsOffline(false);
        // Force refetch to wake up Render API and instantly reload home sections when WiFi restores
        spotlight.refetch();
        trending.refetch();
        popular.refetch();
      };
      const handleOffline = () => {
        setIsOffline(true);
        setActiveTab("offline"); // Auto switch tab to Offline Library when offline
      };
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [spotlight, trending, popular]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialQuery={query} />

      {/* Online/Offline Status Alert Banner */}
      {isOffline && (
        <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2.5 text-center text-xs font-semibold text-destructive flex items-center justify-center gap-2">
          <AlertTriangle size={14} className="animate-bounce" />
          Offline Mode active. Only episodes in your Offline Library can be played.
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {query ? (
          <section>
            <h1 className="text-2xl font-semibold tracking-tight">
              Results for “{query}”
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {search.isLoading
                ? "Searching…"
                : `${search.data?.results?.length ?? 0} matches`}
            </p>
            <Grid items={search.data?.results} loading={search.isLoading} />
          </section>
        ) : (
          <>
            {/* Dashboard Category Selection Tabs */}
            <div className="mb-8 flex items-center justify-start gap-1 border-b border-border/40 pb-px overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab("discover")}
                disabled={isOffline}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition cursor-pointer select-none whitespace-nowrap ${
                  activeTab === "discover"
                    ? "border-primary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <Compass size={16} />
                Discover
              </button>
              <button
                onClick={() => setActiveTab("top")}
                disabled={isOffline}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition cursor-pointer select-none whitespace-nowrap ${
                  activeTab === "top"
                    ? "border-primary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                <TrendingUp size={16} />
                Top Anime
              </button>
              <button
                onClick={() => setActiveTab("offline")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition cursor-pointer select-none whitespace-nowrap ${
                  activeTab === "offline"
                    ? "border-primary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <HardDriveDownload size={16} />
                Offline Library
                {completedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {completedCount}
                  </span>
                )}
              </button>
            </div>

            {/* TAB CONTENTS */}
            {activeTab === "discover" && (
              <>
                <Spotlight items={spotlight.data?.results?.slice(0, 5)} loading={spotlight.isLoading} />
                <ContinueWatching />
                <section className="mt-12">
                  <div className="mb-5 flex items-end justify-between">
                    <h2 className="text-xl font-semibold tracking-tight">Trending now</h2>
                    <span className="text-xs text-muted-foreground">Updated daily</span>
                  </div>
                  <Grid items={trending.data?.results} loading={trending.isLoading} />
                </section>
              </>
            )}

            {activeTab === "top" && (
              <section className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Top Anime</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Highest rated and most popular releases.
                  </p>
                </div>
                <Grid items={popular.data?.results} loading={popular.isLoading} />
              </section>
            )}

            {activeTab === "offline" && (
              <section className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Offline Library</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Episodes saved inside your browser storage, playable completely offline.
                  </p>
                </div>

                {completedDownloads.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                    <HardDriveDownload size={40} className="mx-auto text-muted-foreground opacity-50 mb-3" />
                    <h3 className="text-sm font-semibold text-foreground">Offline Library is Empty</h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                      Go to the Discover tab, open any anime detail page, and click the Download button to save episodes here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {completedDownloads.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setPlayingOfflineEpisode(item)}
                        className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md cursor-pointer"
                      >
                        <div
                          className="block relative aspect-[2/3] w-full overflow-hidden bg-muted"
                        >
                          <img
                            src={item.animeCover}
                            alt={item.animeTitle}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                            <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                              Episode {item.episodeNumber}
                            </span>
                          </div>
                          
                          {/* Premium Play Hover Overlay */}
                          <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                            <div className="rounded-full bg-primary p-3 text-primary-foreground shadow-lg transform scale-90 group-hover:scale-100 transition duration-300">
                              <Play size={20} className="fill-current" />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col p-3" onClick={(e) => e.stopPropagation()}>
                          <span
                            onClick={() => setPlayingOfflineEpisode(item)}
                            className="line-clamp-2 text-xs font-semibold hover:text-primary transition min-h-[2rem] cursor-pointer"
                          >
                            {item.animeTitle}
                          </span>
                          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                            <span className="font-semibold text-green-500">Offline Ready</span>
                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const confirmDelete = window.confirm(
                                  `Are you sure you want to delete Episode ${item.episodeNumber} of ${item.animeTitle} from your local device storage?`
                                );
                                if (confirmDelete) {
                                  await removeDownloadedEpisode(item.animeId, item.episodeNumber);
                                }
                              }}
                              className="hover:text-destructive flex items-center gap-1 transition font-medium cursor-pointer"
                              title="Delete from local device"
                            >
                              <Trash2 size={11} />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-xs text-muted-foreground sm:px-6">
        Gyrucheia · private library
      </footer>

      {playingOfflineEpisode && (
        <OfflinePlayerModal
          episode={playingOfflineEpisode}
          onClose={() => setPlayingOfflineEpisode(null)}
        />
      )}
    </div>
  );
}

function OfflinePlayerModal({
  episode,
  onClose,
}: {
  episode: any;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let offlineUrl = "";
    let hls: Hls | null = null;

    async function startPlay() {
      try {
        const downloadId = episode.id;
        const meta = await getEpisodeMeta(downloadId);
        if (!meta || meta.segmentCount === 0) {
          throw new Error("Video file not found in local browser storage.");
        }

        const video = videoRef.current;
        if (!video) return;

        if (Hls.isSupported()) {
          // Play via custom virtual in-memory HLS stream for Android/Desktop browsers
          const maxDur = Math.ceil(Math.max(...meta.durations, 0) + 1);
          const lines = [
            "#EXTM3U",
            "#EXT-X-VERSION:3",
            `#EXT-X-TARGETDURATION:${maxDur}`,
            "#EXT-X-MEDIA-SEQUENCE:0",
          ];
          for (let i = 0; i < meta.segmentCount; i++) {
            lines.push(`#EXTINF:${(meta.durations[i] || 0).toFixed(3)},`);
            lines.push(`idb://${downloadId}/seg/${i}`);
          }
          lines.push("#EXT-X-ENDLIST");

          const m3u8Blob = new Blob([lines.join("\n")], { type: "application/x-mpegURL" });
          offlineUrl = URL.createObjectURL(m3u8Blob);

          // Custom HLS loader for IndexedDB segments
          const DefaultLoader = Hls.DefaultConfig.loader as any;

          class OfflineIDBLoader extends DefaultLoader {
            private ctrl: AbortController | null = null;
            load(context: any, _config: any, callbacks: any) {
              const url = context.url as string;

              // idb:// segment URL
              if (url.startsWith("idb://")) {
                const withoutScheme = url.slice("idb://".length);
                const slashSeg = withoutScheme.lastIndexOf("/seg/");
                const dlId = withoutScheme.slice(0, slashSeg);
                const segIndex = parseInt(withoutScheme.slice(slashSeg + "/seg/".length), 10);
                const t0 = performance.now();

                getSegmentBlob(dlId, segIndex)
                  .then(async (blob) => {
                    if (!blob) {
                      callbacks.onError(
                        { code: 0, text: `Offline segment ${segIndex} missing from IndexedDB` },
                        context, null, null
                      );
                      return;
                    }
                    const data = await blob.arrayBuffer();
                    callbacks.onSuccess(
                      { url, data },
                      {
                        trequest: t0,
                        ttfb: performance.now(),
                        tload: performance.now(),
                        loaded: data.byteLength,
                        total: data.byteLength,
                      },
                      context
                    );
                  })
                  .catch((err: Error) => {
                    callbacks.onError({ code: 0, text: String(err) }, context, null, null);
                  });
                return;
              }

              // blob: URL (virtual M3U8)
              if (url.startsWith("blob:")) {
                this.ctrl = new AbortController();
                const t0 = performance.now();
                fetch(url, { signal: this.ctrl.signal })
                  .then(async (res) => {
                    const t1 = performance.now();
                    const data =
                      context.responseType === "arraybuffer"
                        ? await res.arrayBuffer()
                        : await res.text();
                    callbacks.onSuccess(
                      { url, data },
                      { trequest: t0, ttfb: t1, tload: performance.now(), loaded: 0, total: 0 },
                      context
                    );
                  })
                  .catch((err: Error) => {
                    if (err?.name === "AbortError") return;
                    callbacks.onError({ code: 0, text: String(err) }, context, null, null);
                  });
                return;
              }

              super.load(context, _config, callbacks);
            }
            abort() { this.ctrl?.abort(); super.abort?.(); }
            destroy() { this.ctrl?.abort(); super.destroy?.(); }
          }

          hls = new Hls({ loader: OfflineIDBLoader as any });
          hls.loadSource(offlineUrl);
          hls.attachMedia(video);
        } else {
          // iOS Safari: native video engine plays concatenated Blob URL
          const segments: Blob[] = [];
          for (let i = 0; i < meta.segmentCount; i++) {
            const segBlob = await getSegmentBlob(downloadId, i);
            if (segBlob) {
              segments.push(segBlob);
            }
          }
          if (segments.length === 0) {
            throw new Error("No segments found for this downloaded episode.");
          }
          const fullBlob = new Blob(segments, { type: "video/mp2t" });
          offlineUrl = URL.createObjectURL(fullBlob);
          video.src = offlineUrl;
        }

        setLoading(false);
        video.play().catch(() => {});

      } catch (err: any) {
        console.error(err);
        if (active) {
          setError(err.message || "Failed to load offline video.");
          setLoading(false);
        }
      }
    }

    startPlay();

    return () => {
      active = false;
      hls?.destroy();
      if (offlineUrl) {
        URL.revokeObjectURL(offlineUrl);
      }
    };
  }, [episode.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between text-white">
          <div>
            <h2 className="text-base font-semibold truncate max-w-sm sm:max-w-md">
              {episode.animeTitle}
            </h2>
            <p className="text-xs text-muted-foreground">
              Episode {episode.episodeNumber} · Playing Offline
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 hover:bg-white/20 transition text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Player Box */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90 text-white">
              <Loader2 className="animate-spin text-primary mr-2" size={20} />
              <span className="text-sm">Loading offline video...</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 text-destructive p-4 text-center">
              <AlertTriangle className="text-destructive mb-2" size={28} />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          )}

          <video
            ref={videoRef}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function Grid({ items, loading }: { items?: AnimeItem[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (!items?.length) {
    return (
      <p className="mt-10 text-center text-sm text-muted-foreground">Nothing here.</p>
    );
  }
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((a) => (
        <AnimeCard key={a.id} anime={a} />
      ))}
    </div>
  );
}

function Spotlight({ items, loading }: { items?: AnimeItem[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="h-72 animate-pulse rounded-3xl bg-muted sm:h-80" />
    );
  }
  if (!items?.length) return null;
  const hero = items[0];
  return (
    <section className="space-y-4">
      <article className="grid items-stretch gap-6 overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-sm sm:grid-cols-[200px_1fr] sm:p-6">
        <Link
          to="/anime/$id"
          params={{ id: String(hero.id) }}
          className="block overflow-hidden rounded-2xl bg-muted shadow-sm"
        >
          <img
            src={posterOf(hero)}
            alt={titleOf(hero)}
            className="h-full w-full object-cover"
          />
        </Link>
        <div className="flex flex-col justify-center">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            In the spotlight
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {titleOf(hero)}
          </h1>
          <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted-foreground">
            {stripHtml(hero.description)}
          </p>
          <div className="mt-5">
            <Link
              to="/anime/$id"
              params={{ id: String(hero.id) }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <Play size={16} /> Watch now
            </Link>
          </div>
        </div>
      </article>

      {items.length > 1 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.slice(1, 5).map((a) => (
            <Link
              key={a.id}
              to="/anime/$id"
              params={{ id: String(a.id) }}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <img
                src={posterOf(a)}
                alt={titleOf(a)}
                className="h-16 w-12 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium group-hover:text-primary">
                  {titleOf(a)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.seasonYear ?? ""} {a.format ? `• ${a.format}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ContinueWatching() {
  const { watchHistory, removeWatchHistoryItem } = useWatchHistory();
  if (watchHistory.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Continue Watching</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {watchHistory.map((item) => {
          const progress = Math.min(Math.round((item.timestamp / item.duration) * 100), 100);
          return (
            <div
              key={item.animeId}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <Link
                to="/anime/$id"
                params={{ id: String(item.animeId) }}
                className="block relative aspect-video w-full overflow-hidden bg-muted"
              >
                <img
                  src={item.animeCover}
                  alt={item.animeTitle}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                  <span className="rounded bg-primary/95 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Episode {item.episodeNumber}
                  </span>
                </div>
              </Link>
              <div className="flex flex-1 flex-col p-3">
                <Link
                  to="/anime/$id"
                  params={{ id: String(item.animeId) }}
                  className="line-clamp-1 text-sm font-semibold hover:text-primary transition"
                >
                  {item.animeTitle}
                </Link>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{progress}% watched</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWatchHistoryItem(item.animeId);
                    }}
                    className="hover:text-destructive transition text-[10px] font-medium"
                    title="Remove from history"
                  >
                    Remove
                  </button>
                </div>
                {/* Watch progress bar */}
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
