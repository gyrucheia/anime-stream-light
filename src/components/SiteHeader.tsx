import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function SiteHeader({ initialQuery = "" }: { initialQuery?: string }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [q, setQ] = useState(initialQuery);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate({ to: "/", search: term ? { q: term } : {} });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background">
            <span className="text-sm font-semibold">G</span>
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Gyrucheia
          </span>
        </Link>
        <form onSubmit={submit} className="flex flex-1 items-center">
          <div className="relative w-full">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder="Search anime…"
              className="h-10 w-full rounded-full border border-border bg-muted/50 pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </form>
        <button
          type="button"
          onClick={logout}
          aria-label="Lock"
          title="Lock"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
