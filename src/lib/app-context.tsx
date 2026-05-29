import React, { createContext, useContext, useState, useEffect } from "react";
import { api, AnimeItem, EpisodeMeta, Stream, proxiedM3U8 } from "./api";

// ==========================================
// 1. THEME CONTEXT
// ==========================================
type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gyrucheia_theme");
      if (saved === "light" || saved === "dark") return saved;
      return "dark"; // Gyrucheia defaults to dark for cinema-like experience
    }
    return "dark";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("gyrucheia_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}

// ==========================================
// 2. SEARCH HISTORY CONTEXT
// ==========================================
interface SearchHistoryContextType {
  searchHistory: string[];
  addSearchQuery: (q: string) => void;
  removeSearchQuery: (q: string) => void;
  clearSearchHistory: () => void;
}

const SearchHistoryContext = createContext<SearchHistoryContextType | undefined>(undefined);

export function SearchHistoryProvider({ children }: { children: React.ReactNode }) {
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gyrucheia_search_history");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("gyrucheia_search_history", JSON.stringify(searchHistory));
  }, [searchHistory]);

  const addSearchQuery = (q: string) => {
    const term = q.trim();
    if (!term) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== term.toLowerCase());
      return [term, ...filtered].slice(0, 8); // Keep last 8 unique queries
    });
  };

  const removeSearchQuery = (q: string) => {
    setSearchHistory((prev) => prev.filter((item) => item !== q));
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
  };

  return (
    <SearchHistoryContext.Provider
      value={{ searchHistory, addSearchQuery, removeSearchQuery, clearSearchHistory }}
    >
      {children}
    </SearchHistoryContext.Provider>
  );
}

export function useSearchHistory() {
  const context = useContext(SearchHistoryContext);
  if (!context) throw new Error("useSearchHistory must be used within a SearchHistoryProvider");
  return context;
}

// ==========================================
// 3. WATCH HISTORY CONTEXT
// ==========================================
export interface WatchItem {
  animeId: number;
  animeTitle: string;
  animeCover: string;
  episodeNumber: number;
  timestamp: number; // in seconds
  duration: number; // in seconds
  updatedAt: number;
}

interface WatchHistoryContextType {
  watchHistory: WatchItem[];
  saveWatchPosition: (
    animeId: number,
    animeTitle: string,
    animeCover: string,
    episodeNumber: number,
    timestamp: number,
    duration: number
  ) => void;
  getSavedPosition: (animeId: number, episodeNumber: number) => number;
  removeWatchHistoryItem: (animeId: number) => void;
}

const WatchHistoryContext = createContext<WatchHistoryContextType | undefined>(undefined);

export function WatchHistoryProvider({ children }: { children: React.ReactNode }) {
  const [watchHistory, setWatchHistory] = useState<WatchItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gyrucheia_watch_history");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("gyrucheia_watch_history", JSON.stringify(watchHistory));
  }, [watchHistory]);

  const saveWatchPosition = (
    animeId: number,
    animeTitle: string,
    animeCover: string,
    episodeNumber: number,
    timestamp: number,
    duration: number
  ) => {
    if (!animeId || duration <= 0) return;
    setWatchHistory((prev) => {
      // Keep only one watch history item per anime to build a clean "Continue Watching" row
      const filtered = prev.filter((item) => item.animeId !== animeId);
      const newItem: WatchItem = {
        animeId,
        animeTitle,
        animeCover,
        episodeNumber,
        timestamp,
        duration,
        updatedAt: Date.now(),
      };
      return [newItem, ...filtered];
    });
  };

  const getSavedPosition = (animeId: number, episodeNumber: number) => {
    const matched = watchHistory.find(
      (item) => item.animeId === animeId && item.episodeNumber === episodeNumber
    );
    return matched ? matched.timestamp : 0;
  };

  const removeWatchHistoryItem = (animeId: number) => {
    setWatchHistory((prev) => prev.filter((item) => item.animeId !== animeId));
  };

  return (
    <WatchHistoryContext.Provider
      value={{ watchHistory, saveWatchPosition, getSavedPosition, removeWatchHistoryItem }}
    >
      {children}
    </WatchHistoryContext.Provider>
  );
}

export function useWatchHistory() {
  const context = useContext(WatchHistoryContext);
  if (!context) throw new Error("useWatchHistory must be used within a WatchHistoryProvider");
  return context;
}

// ==========================================
// 4. NOTIFICATIONS CONTEXT (WITH FAVORITES)
// ==========================================
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  type: "update" | "favorite" | "download";
  read: boolean;
}

export interface FavoriteItem {
  anime: AnimeItem;
  lastEpisodeCount: number;
  addedAt: number;
}

interface NotificationContextType {
  notifications: AppNotification[];
  favorites: FavoriteItem[];
  addNotification: (title: string, message: string, type: AppNotification["type"]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  toggleFavorite: (anime: AnimeItem) => void;
  isFavorite: (animeId: number) => boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gyrucheia_notifications");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gyrucheia_favorites");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("gyrucheia_notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem("gyrucheia_favorites", JSON.stringify(favorites));
  }, [favorites]);

  const addNotification = (title: string, message: string, type: AppNotification["type"]) => {
    setNotifications((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        title,
        message,
        timestamp: Date.now(),
        type,
        read: false,
      },
      ...prev,
    ]);
  };

  // Trigger announcement once on first install/load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const shownAnnouncement = localStorage.getItem("gyrucheia_announced_v2");
      if (!shownAnnouncement) {
        addNotification(
          "Welcome to Gyrucheia V2!",
          "New features are now live: Watch History, Dark Mode, Favorites, and Background Downloads!",
          "update"
        );
        localStorage.setItem("gyrucheia_announced_v2", "true");
      }
    }
  }, []);

  // Background Favorite Updates Checking
  useEffect(() => {
    if (!favorites.length) return;

    // Check updates for favorites 10 seconds after load
    const timer = setTimeout(async () => {
      for (const fav of favorites) {
        try {
          const res = await api.episodes(fav.anime.id);
          const providers = res.providers ?? {};
          let currentEps = 0;
          for (const key of Object.keys(providers)) {
            const list = providers[key]?.episodes?.sub || providers[key]?.episodes?.dub;
            if (list && list.length > currentEps) {
              currentEps = list.length;
            }
          }

          if (currentEps > fav.lastEpisodeCount) {
            // Update stored last episode count
            setFavorites((prev) =>
              prev.map((item) =>
                item.anime.id === fav.anime.id
                  ? { ...item, lastEpisodeCount: currentEps }
                  : item
              )
            );
            addNotification(
              "New Episode available!",
              `Episode ${currentEps} is now available for ${
                fav.anime.title.english || fav.anime.title.romaji || "your favorite anime"
              }.`,
              "favorite"
            );
          }
        } catch (err) {
          console.error(`Failed to fetch updates for favorite anime ID ${fav.anime.id}:`, err);
        }
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [favorites]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const toggleFavorite = (anime: AnimeItem) => {
    setFavorites((prev) => {
      const isAlreadyFav = prev.some((item) => item.anime.id === anime.id);
      if (isAlreadyFav) {
        return prev.filter((item) => item.anime.id !== anime.id);
      } else {
        // Assume current episode count as 1 or fetch to fill
        return [
          {
            anime,
            lastEpisodeCount: anime.episodes ?? 0,
            addedAt: Date.now(),
          },
          ...prev,
        ];
      }
    });
  };

  const isFavorite = (animeId: number) => {
    return favorites.some((item) => item.anime.id === animeId);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        favorites,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within a NotificationProvider");
  return context;
}

// ==========================================
// 5. BACKGROUND DOWNLOAD CONTEXT (DEVICE ISOLATION)
// ==========================================
export interface DownloadProgress {
  id: string; // `${animeId}_ep_${episodeNumber}`
  animeId: number;
  animeTitle: string;
  episodeNumber: number;
  progress: number;
  status: "downloading" | "completed" | "failed";
  error?: string;
}

interface DownloadContextType {
  activeDownloads: Record<string, DownloadProgress>;
  startDownload: (
    animeId: number,
    animeTitle: string,
    episodeMeta: EpisodeMeta,
    stream: Stream
  ) => Promise<void>;
  clearCompletedDownloads: () => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadProgress>>({});
  const { addNotification } = useNotifications();

  const startDownload = async (
    animeId: number,
    animeTitle: string,
    episodeMeta: EpisodeMeta,
    stream: Stream
  ) => {
    const downloadId = `${animeId}_ep_${episodeMeta.number}`;
    if (activeDownloads[downloadId]?.status === "downloading") return;

    // Register active download in global state
    setActiveDownloads((prev) => ({
      ...prev,
      [downloadId]: {
        id: downloadId,
        animeId,
        animeTitle,
        episodeNumber: episodeMeta.number,
        progress: 0,
        status: "downloading",
      },
    }));

    const src = proxiedM3U8(stream.url, stream.referer);

    try {
      // ── Step 1: Fetch top-level playlist ───────────────────────────
      const topRes = await fetch(src);
      if (!topRes.ok) throw new Error(`Playlist fetch failed: ${topRes.status}`);
      const topText = await topRes.text();

      // ── Step 2: Resolve master → media playlist if needed ─────────────
      let mediaText = topText;
      let mediaBaseUrl = src;

      if (topText.includes("#EXT-X-STREAM-INF")) {
        const variantLine = topText
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.length > 0 && !l.startsWith("#"));

        if (variantLine) {
          mediaBaseUrl = variantLine.startsWith("http")
            ? variantLine
            : new URL(variantLine, src).href;
          const mediaRes = await fetch(mediaBaseUrl);
          if (!mediaRes.ok) throw new Error(`Variant fetch failed: ${mediaRes.status}`);
          mediaText = await mediaRes.text();
        }
      }

      // ── Step 3: Extract segment URLs ───────────────────────────────────
      const segmentUrls = mediaText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#"))
        .map((l) => (l.startsWith("http") ? l : new URL(l, mediaBaseUrl).href));

      if (!segmentUrls.length) {
        throw new Error("No segments found in playlist.");
      }

      // ── Step 4: Fetch segments sequentially through the proxy ──────────
      const buffers: ArrayBuffer[] = [];
      for (let i = 0; i < segmentUrls.length; i++) {
        const segRes = await fetch(segmentUrls[i]);
        if (!segRes.ok) throw new Error(`Segment ${i + 1} failed: ${segRes.status}`);
        buffers.push(await segRes.arrayBuffer());

        // Update progress in state
        const currentProgress = Math.round(((i + 1) / segmentUrls.length) * 100);
        setActiveDownloads((prev) => ({
          ...prev,
          [downloadId]: {
            ...prev[downloadId],
            progress: currentProgress,
          },
        }));
      }

      // ── Step 5: Concatenate and save locally ───────────────────────────
      const blob = new Blob(buffers, { type: "video/mp2t" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${animeTitle.replace(/[^a-z0-9]+/gi, "_")}_Ep_${episodeMeta.number}.ts`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      // Complete download in state
      setActiveDownloads((prev) => ({
        ...prev,
        [downloadId]: {
          ...prev[downloadId],
          progress: 100,
          status: "completed",
        },
      }));

      // Trigger user-specific local success notification
      addNotification(
        "Download completed!",
        `Episode ${episodeMeta.number} of ${animeTitle} downloaded successfully to this device.`,
        "download"
      );
    } catch (err: any) {
      console.error("[DownloadProvider] Background download failed:", err);
      setActiveDownloads((prev) => ({
        ...prev,
        [downloadId]: {
          ...prev[downloadId],
          status: "failed",
          error: err.message || String(err),
        },
      }));

      addNotification(
        "Download failed",
        `Episode ${episodeMeta.number} of ${animeTitle} failed to download: ${err.message || err}`,
        "download"
      );
    }
  };

  const clearCompletedDownloads = () => {
    setActiveDownloads((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key].status === "completed" || next[key].status === "failed") {
          delete next[key];
        }
      }
      return next;
    });
  };

  return (
    <DownloadContext.Provider value={{ activeDownloads, startDownload, clearCompletedDownloads }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useBackgroundDownloads() {
  const context = useContext(DownloadContext);
  if (!context) throw new Error("useBackgroundDownloads must be used within a DownloadProvider");
  return context;
}

// ==========================================
// UNIFIED APP PROVIDERS WRAPPER
// ==========================================
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <DownloadProvider>
          <WatchHistoryProvider>
            <SearchHistoryProvider>{children}</SearchHistoryProvider>
          </WatchHistoryProvider>
        </DownloadProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
