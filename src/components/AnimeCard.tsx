import { Link } from "@tanstack/react-router";
import { AnimeItem, posterOf, titleOf, stripHtml } from "@/lib/api";

export function AnimeCard({ anime }: { anime: AnimeItem }) {
  const title = titleOf(anime);
  return (
    <Link
      to="/anime/$id"
      params={{ id: String(anime.id) }}
      className="group block"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-sm transition-shadow group-hover:shadow-md">
        {posterOf(anime) ? (
          <img
            src={posterOf(anime)}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <div className="mt-3 px-0.5">
        <h3 className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">
          {title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {stripHtml(anime.description) || (anime.genres || []).join(" • ")}
        </p>
      </div>
    </Link>
  );
}
