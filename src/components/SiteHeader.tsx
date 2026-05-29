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
  CheckCheck
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useTheme,
  useSearchHistory,
  useNotifications,
  useBackgroundDownloads
} from "@/lib/app-context";

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

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background transition">
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

        <div className="flex items-center gap-1 sm:gap-2">
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
                        onClick={() => markAsRead(n.id)}
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

      {/* Search History Chips */}
      {searchHistory.length > 0 && (
        <div className="mx-auto max-w-6xl flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6 -mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Recent Searches:</span>
          {searchHistory.map((query) => (
            <span
              key={query}
              onClick={() => {
                setQ(query);
                navigate({ to: "/", search: { q: query } });
              }}
              className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2.5 py-0.5 text-xs text-foreground cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
            >
              {query}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSearchQuery(query);
                }}
                className="rounded-full p-0.5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

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
