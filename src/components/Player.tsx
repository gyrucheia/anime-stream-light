import Hls from "hls.js";
import { Download, Loader2, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Stream, EpisodeMeta, proxiedM3U8 } from "@/lib/api";
import { useWatchHistory, useBackgroundDownloads } from "@/lib/app-context";
import { getVideoBlob } from "@/lib/offline-db";

export function Player({
  stream,
  title,
  animeId,
  animeCover,
  episodeNumber,
  episodeMeta,
}: {
  stream: Stream | null;
  title: string;
  animeId: number;
  animeCover: string;
  episodeNumber: number;
  episodeMeta: EpisodeMeta | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { saveWatchPosition, getSavedPosition } = useWatchHistory();
  const { activeDownloads, startDownload } = useBackgroundDownloads();

  const downloadId = `${animeId}_ep_${episodeNumber}`;
  const currentDl = activeDownloads[downloadId];
  const downloading = currentDl?.status === "downloading";
  const isCompleted = currentDl?.status === "completed";
  const dlProgress = currentDl?.progress ?? 0;

  const src = stream ? proxiedM3U8(stream.url, stream.referer) : "";
  // null = not loaded yet, "" = no source, string = url/bloburl
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isOfflineBlob, setIsOfflineBlob] = useState(false);

  // Resolve the correct video source: offline blob (priority) or live HLS stream
  useEffect(() => {
    let active = true;
    let createdBlobUrl = "";

    async function loadVideoSource() {
      if (isCompleted) {
        try {
          const blob = await getVideoBlob(downloadId);
          if (blob && active) {
            // ✅ Direct blob URL — works on Android Chrome & iOS Safari alike.
            // Skips HLS.js entirely since the file is already fully downloaded.
            // The blob-in-M3U8 approach fails on Android because HLS.js's
            // XHR loader cannot follow blob: URLs as segment sources.
            createdBlobUrl = URL.createObjectURL(blob);
            setVideoSrc(createdBlobUrl);
            setIsOfflineBlob(true);
            return;
          }
        } catch (err) {
          console.error("Failed to load offline video blob from IndexedDB:", err);
        }
      }

      if (active) {
        setVideoSrc(src);
        setIsOfflineBlob(false);
      }
    }

    loadVideoSource();

    return () => {
      active = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [src, isCompleted, downloadId]);

  // Attach video source to the <video> element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoSrc === null) return;

    // ── Offline blob path: set src directly, no HLS.js needed ──────────
    if (isOfflineBlob && videoSrc) {
      // Destroy any existing HLS instance before setting src directly
      video.src = videoSrc;
      video.load();
      return;
    }

    // ── Live network HLS stream path ────────────────────────────────────
    if (!videoSrc) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // iOS Safari native HLS
      video.src = videoSrc;
    }
    return () => {
      hls?.destroy();
    };
  }, [videoSrc, isOfflineBlob]);

  // Handle Watch Progress (Save Timestamp)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let lastSavedTime = 0;
    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      const duration = video.duration;
      if (duration > 0 && Math.abs(currentTime - lastSavedTime) > 3) {
        saveWatchPosition(animeId, title, animeCover, episodeNumber, currentTime, duration);
        lastSavedTime = currentTime;
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [animeId, episodeNumber, title, animeCover, saveWatchPosition]);

  // Handle Resume Position (Restore Timestamp)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const savedTime = getSavedPosition(animeId, episodeNumber);
      if (savedTime > 0 && Math.abs(video.currentTime - savedTime) > 5) {
        video.currentTime = savedTime;
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [animeId, episodeNumber, getSavedPosition]);

  const download = async () => {
    if ((!stream && !isCompleted) || !episodeMeta) return;

    if (isCompleted) {
      const confirmDl = window.confirm(
        `This episode is already downloaded. Are you sure you want to download it again?`
      );
      if (!confirmDl) return;
    }

    await startDownload(animeId, title, episodeMeta, stream!, animeCover);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
        <video
          ref={videoRef}
          controls
          playsInline
          className="aspect-video w-full bg-black"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm text-muted-foreground">
          {stream
            ? `Streaming via ${stream.server.replace(/-$/, "")}`
            : "Pick an episode to start watching."}
        </p>

        <div className="flex flex-col items-end gap-1.5">
          <button
            id="download-episode-btn"
            onClick={download}
            disabled={(!stream && !isCompleted) || downloading}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isCompleted
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {downloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isCompleted ? (
              <Check size={16} />
            ) : (
              <Download size={16} />
            )}
            {downloading ? `Downloading ${dlProgress}%` : isCompleted ? "Downloaded" : "Download"}
          </button>

          {/* Progress bar — only visible while downloading */}
          {downloading && (
            <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${dlProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
