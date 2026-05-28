import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Player } from "@/components/Player";
import { api, EpisodeMeta, posterOf, stripHtml, titleOf } from "@/lib/api";
import { ArrowLeft, Star } from "lucide-react";

export const Route = createFileRoute("/anime/$id")({
  component: Details,
});

function Details() {
  const { id } = Route.useParams();
  const anilistId = Number(id);

  const info = useQuery({
    queryKey: ["info", anilistId],
    queryFn: () => api.info(anilistId),
  });

  const eps = useQuery({
    queryKey: ["eps", anilistId],
    queryFn: () => api.episodes(anilistId),
  });

  const episodes: EpisodeMeta[] = useMemo(() => {
    const providers = eps.data?.providers ?? {};
    for (const key of Object.keys(providers)) {
      const list =
        providers[key]?.episodes?.sub || providers[key]?.episodes?.dub;
      if (list && list.length) return list;
    }
    return [];
  }, [eps.data]);

  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (selected == null && episodes.length) setSelected(episodes[0].number);
  }, [episodes, selected]);

  const stream = useQuery({
    queryKey: ["stream", anilistId, selected],
    queryFn: () => api.extract(anilistId, selected!),
    enabled: selected != null,
  });

  const chosenStream = stream.data?.streams?.find((s) => s.type === "hls") ?? null;

  const title = info.data ? titleOf(info.data) : "Loading…";
  const description = stripHtml(info.data?.description);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Player stream={chosenStream} title={`${title}-ep${selected ?? 1}`} />

            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {info.data?.seasonYear && <span>{info.data.seasonYear}</span>}
                {info.data?.format && <span>• {info.data.format}</span>}
                {info.data?.status && <span>• {info.data.status}</span>}
                {info.data?.averageScore != null && (
                  <span className="inline-flex items-center gap-1">
                    • <Star size={12} className="fill-primary text-primary" />
                    {info.data.averageScore}/100
                  </span>
                )}
              </div>
              {info.data?.genres?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {info.data.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {description || (info.isLoading ? "Loading synopsis…" : "No synopsis available.")}
              </p>
            </div>

            <EpisodeList
              episodes={episodes}
              selected={selected}
              onSelect={setSelected}
              loading={eps.isLoading}
            />
          </div>

          <aside className="order-first lg:order-last">
            {info.data && (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <img
                  src={posterOf(info.data)}
                  alt={title}
                  className="aspect-[2/3] w-full object-cover"
                />
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function EpisodeList({
  episodes,
  selected,
  onSelect,
  loading,
}: {
  episodes: EpisodeMeta[];
  selected: number | null;
  onSelect: (n: number) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Loading episodes…</p>
      </div>
    );
  }
  if (!episodes.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          No episodes available from any provider.
        </p>
      </div>
    );
  }
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Episodes</h2>
        <span className="text-xs text-muted-foreground">{episodes.length} total</span>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {episodes.map((ep) => {
          const active = selected === ep.number;
          return (
            <button
              key={ep.id}
              title={ep.title || `Episode ${ep.number}`}
              onClick={() => onSelect(ep.number)}
              className={
                "h-10 rounded-lg text-sm font-medium transition " +
                (active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-foreground hover:bg-primary/10 hover:text-primary")
              }
            >
              {ep.number}
            </button>
          );
        })}
      </div>
      {selected != null && (
        <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">
          Ep {selected}: {episodes.find((e) => e.number === selected)?.title ?? ""}
        </p>
      )}
    </section>
  );
}
