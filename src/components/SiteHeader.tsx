import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Search,
  LogOut,
  Sun,
  Moon,
  Bell,
  Sparkles,
  Trash2,
  Check,
  Download,
  AlertCircle,
  X,
  Star,
  CheckCheck,
  Loader2
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useTheme,
  useSearchHistory,
  useNotifications,
  useBackgroundDownloads
} from "@/lib/app-context";
import { AnimeItem, posterOf, titleOf, api } from "@/lib/api";

export function SiteHeader({ initialQuery = "" }: { initialQuery?: string }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { searchHistory, addSearchQuery, removeSearchQuery } = useSearchHistory();
  const { notifications, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
  const { activeDownloads, clearCompletedDownloads } = useBackgroundDownloads();

  const [q, setQ] = useState(initialQuery);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Suggestions & Autocomplete Dropdown State
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<AnimeItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close search suggestions dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounce search queries to fetch suggested anime titles
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setSuggestions([]);
      return;
    }

    setSuggestionsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.search(query, 1);
        setSuggestions(res?.results?.slice(0, 6) ?? []);
      } catch (err) {
        console.error("Suggestions fetch error:", err);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) {
      addSearchQuery(term);
    }
    navigate({ to: "/", search: term ? { q: term } : {} });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeDownloadsList = Object.values(activeDownloads);
  const downloadingCount = activeDownloadsList.filter((d) => d.status === "downloading").length;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur transition-colors duration-300">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        {/* Logo — hide text on mobile when search is focused */}
        <Link
          to="/"
          className={`flex shrink-0 items-center gap-2 transition-all duration-300 ${
            isFocused ? "max-sm:hidden" : ""
          }`}
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background transition">
            <span className="text-sm font-semibold">G</span>
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Gyrucheia
          </span>
        </Link>

        <form
          onSubmit={submit}
          className={`flex items-center transition-all duration-300 ${
            isFocused ? "flex-1" : "flex-1"
          }`}
          ref={searchRef}
        >
          <div className="relative w-full">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setIsFocused(true)}
              type="search"
              placeholder="Search anime…"
              className="h-10 w-full rounded-full border border-border bg-muted/50 pl-9 pr-4 text-sm outline-none transition-all duration-300 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
            />

            {/* Floating Autocomplete suggestions card */}
            {isFocused && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
                style={{ minWidth: "min(92vw, 400px)", left: "50%", transform: "translateX(-50%)" }}
              >
                {q.trim() === "" ? (
                  // Recent search history (input focused & empty)
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Recent Searches
                      </span>
                      {searchHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            localStorage.setItem("gyrucheia_search_history", "[]");
                            window.location.reload();
                          }}
                          className="text-[10px] font-semibold text-destructive hover:underline"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {searchHistory.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Type to search anime titles...
                      </p>
                    ) : (
                      <div className="space-y-0.5">
                        {searchHistory.map((query) => (
                          <div
                            key={query}
                            className="flex items-center justify-between rounded-lg px-2 py-2 transition hover:bg-muted/60"
                          >
                            <span
                              onClick={() => {
                                setQ(query);
                                navigate({ to: "/", search: { q: query } });
                                setIsFocused(false);
                              }}
                              className="flex-1 cursor-pointer text-sm font-medium hover:text-primary text-foreground"
                            >
                              {query}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSearchQuery(query);
                              }}
                              className="ml-2 shrink-0 rounded-full p-1.5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition"
                              title="Delete recent query"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Suggested search results (matching typed anime titles)
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        {suggestionsLoading && <Loader2 size={12} className="animate-spin text-primary" />}
                        Suggested Search
                      </span>
                    </div>

                    {suggestionsLoading && suggestions.length === 0 ? (
                      <div className="space-y-3 py-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="h-12 w-9 animate-pulse rounded bg-muted" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                              <div className="h-2 w-1/3 animate-pulse rounded bg-muted" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : suggestions.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        No matches found. Press Enter to search.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {suggestions.map((s) => (
                          <Link
                            key={s.id}
                            to="/anime/$id"
                            params={{ id: String(s.id) }}
                            onClick={() => setIsFocused(false)}
                            className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted/50"
                          >
                            <img
                              src={posterOf(s)}
                              alt={titleOf(s)}
                              className="h-12 w-9 shrink-0 rounded object-cover bg-muted border border-border/20"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold hover:text-primary leading-tight text-foreground">
                                {titleOf(s)}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {s.seasonYear ?? ""} {s.format ? `• ${s.format}` : ""}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Action buttons — hide on mobile when search is focused */}
        <div className={`flex items-center gap-1 sm:gap-2 transition-all duration-300 ${
          isFocused ? "max-sm:hidden" : ""
        }`}>
          {/* Active Downloads Status Icon */}
          {activeDownloadsList.length > 0 && (
            <button
              onClick={() => setShowDownloads(!showDownloads)}
              className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground ${
                downloadingCount > 0 ? "animate-pulse text-primary" : ""
              }`}
              title="Download Progress"
            >
              <Download size={16} className={downloadingCount > 0 ? "text-primary" : ""} />
              {downloadingCount > 0 && (
                <span className="absolute right-2 top-2 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </span>
              )}
            </button>
          )}

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            title={theme === "dark" ? "Light Mode" : "Dark Mode"}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun size={16} className="transition-transform duration-500 hover:rotate-45" />
            ) : (
              <Moon size={16} className="transition-transform duration-500 hover:-rotate-12" />
            )}
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="Notifications"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-card p-4 shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  <div className="flex gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                        title="Mark all as read"
                      >
                        <CheckCheck size={12} />
                        Read all
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={clearNotifications}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive hover:underline font-medium"
                        title="Clear all"
                      >
                        <Trash2 size={12} />
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markAsRead(n.id);
                          if (n.animeId) {
                            navigate({ to: "/anime/$id", params: { id: String(n.animeId) } });
                            setShowNotifications(false);
                          }
                        }}
                        className={`flex gap-3 rounded-xl border border-transparent p-2.5 transition cursor-pointer hover:bg-muted/30 ${
                          !n.read ? "bg-muted/10 border-border/40 font-medium" : ""
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {n.type === "favorite" ? (
                            <Star size={14} className="fill-yellow-500 text-yellow-500" />
                          ) : n.type === "download" ? (
                            <Download size={14} className="text-green-500" />
                          ) : (
                            <Sparkles size={14} className="text-blue-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground leading-snug">{n.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-normal">
                            {n.message}
                          </p>
                          <p className="mt-1 text-[9px] text-muted-foreground/60">
                            {new Date(n.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                        {!n.read && (
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary mt-1.5" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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
      </div>



      {/* Background Active Downloads Floating Drawer */}
      {showDownloads && activeDownloadsList.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Background Downloads
            </h3>
            <div className="flex gap-2">
              <button
                onClick={clearCompletedDownloads}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Clear Done
              </button>
              <button
                onClick={() => setShowDownloads(false)}
                className="rounded-md p-0.5 hover:bg-muted text-muted-foreground"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-3">
            {activeDownloadsList.map((d) => (
              <div key={d.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="truncate pr-2">{d.animeTitle}</span>
                  <span className="shrink-0 text-muted-foreground text-[10px]">
                    Ep {d.episodeNumber}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        d.status === "failed"
                          ? "bg-destructive"
                          : d.status === "completed"
                          ? "bg-green-500"
                          : "bg-primary"
                      }`}
                      style={{ width: `${d.progress}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums font-semibold text-muted-foreground">
                    {d.status === "failed" ? (
                      <AlertCircle size={12} className="text-destructive inline" />
                    ) : d.status === "completed" ? (
                      <Check size={12} className="text-green-500 inline font-bold" />
                    ) : (
                      `${d.progress}%`
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
