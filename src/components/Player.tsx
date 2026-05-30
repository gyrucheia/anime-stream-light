import Hls from "hls.js";
import { Download, Loader2, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Stream, EpisodeMeta, proxiedM3U8 } from "@/lib/api";
import { useWatchHistory, useBackgroundDownloads } from "@/lib/app-context";

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

  // ── Attach live network video source to the <video> element ────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // iOS Safari native HLS
      video.src = src;
    }

    return () => {
      hls?.destroy();
    };
  }, [src]);

  // ── Save watch progress every 3 seconds ──────────────────────────────────
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

  // ── Restore saved watch position on load ──────────────────────────────────
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
