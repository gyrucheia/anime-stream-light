import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { AnimeCard } from "@/components/AnimeCard";
import { api, AnimeItem, posterOf, stripHtml, titleOf } from "@/lib/api";
import { z } from "zod";
import { Play } from "lucide-react";
import { useWatchHistory } from "@/lib/app-context";

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

  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: () => api.trending(1, 24),
    enabled: !query,
    staleTime: 5 * 60_000,
  });

  const spotlight = useQuery({
    queryKey: ["spotlight"],
    queryFn: () => api.spotlight(),
    enabled: !query,
    staleTime: 5 * 60_000,
  });

  const search = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.search(query, 1),
    enabled: !!query,
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialQuery={query} />

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
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-xs text-muted-foreground sm:px-6">
        Gyrucheia · private library
      </footer>
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
