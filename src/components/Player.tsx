import Hls from "hls.js";
import { Download, Loader2, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Stream, EpisodeMeta, proxiedM3U8 } from "@/lib/api";
import { useWatchHistory, useBackgroundDownloads } from "@/lib/app-context";
import { getEpisodeMeta, getSegmentBlob } from "@/lib/offline-db";

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

  // Ref so we can read the latest isCompleted inside effects WITHOUT adding
  // it to the dependency array — this prevents the player from restarting
  // when a download finishes while the episode is already playing.
  const isCompletedRef = useRef(isCompleted);
  isCompletedRef.current = isCompleted;

  const src = stream ? proxiedM3U8(stream.url, stream.referer) : "";
  // null = not yet resolved; "" = no source available; string = URL to load
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isOfflineBlob, setIsOfflineBlob] = useState(false);

  // ── Resolve the correct video source per episode ──────────────────────────
  // Runs only when the stream URL or episode changes (NOT when isCompleted
  // changes), so an in-progress or just-finished download won't interrupt
  // the currently playing video.
  useEffect(() => {
    let active = true;
    let createdBlobUrl = "";

    async function loadVideoSource() {
      // Read latest isCompleted from ref (avoids stale closure without adding to deps)
      if (isCompletedRef.current) {
        try {
          const meta = await getEpisodeMeta(downloadId);
          if (meta && meta.segmentCount > 0 && active) {
            // Build a proper segmented virtual M3U8 with idb:// segment URLs.
            // HLS.js will fetch each segment on-demand from IndexedDB via the
            // custom loader below, keeping RAM usage low on mobile devices.
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
            createdBlobUrl = URL.createObjectURL(m3u8Blob);
            setVideoSrc(createdBlobUrl);
            setIsOfflineBlob(true);
            return;
          }
        } catch (err) {
          console.error("Failed to load offline episode meta from IndexedDB:", err);
        }
      }

      // Fall back to live network HLS stream
      if (active) {
        setVideoSrc(src);
        setIsOfflineBlob(false);
      }
    }

    loadVideoSource();

    return () => {
      active = false;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, downloadId]); // isCompleted intentionally omitted — read via ref to avoid mid-stream restart

  // ── Attach video source to the <video> element ────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoSrc === null) return;

    let hls: Hls | null = null;

    if (isOfflineBlob && videoSrc) {
      // ── Offline path ──────────────────────────────────────────────────────
      if (Hls.isSupported()) {
        // Android Chrome / Desktop:
        // HLS.js remuxes MPEG-TS → fMP4 for MSE playback. We provide a custom
        // loader that handles two special URL schemes:
        //   idb://{downloadId}/seg/{i}  → reads segment blob from IndexedDB
        //   blob:…                       → reads the virtual M3U8 via fetch()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const DefaultLoader = Hls.DefaultConfig.loader as any;

        class OfflineIDBLoader extends DefaultLoader {
          private ctrl: AbortController | null = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          load(context: any, _config: any, callbacks: any) {
            const url = context.url as string;

            // ── idb:// segment URL ─────────────────────────────────────────
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

            // ── blob: URL (the virtual M3U8) ───────────────────────────────
            // fetch() supports blob: URLs; HLS.js's default XHR loader may not
            // handle them reliably on Android Chrome.
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

            // Any other URL: fall back to default HLS.js XHR loader
            super.load(context, _config, callbacks);
          }
          abort() { this.ctrl?.abort(); super.abort?.(); }
          destroy() { this.ctrl?.abort(); super.destroy?.(); }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hls = new Hls({ loader: OfflineIDBLoader as any });
        hls.loadSource(videoSrc); // videoSrc = blob: URL of the virtual M3U8
        hls.attachMedia(video);
      } else {
        // iOS Safari: native MPEG-TS support — play the M3U8 blob URL directly
        video.src = videoSrc;
        video.load();
      }
    } else {
      // ── Live network HLS stream path ────────────────────────────────────
      if (!videoSrc) return;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true });
        hls.loadSource(videoSrc);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // iOS Safari native HLS
        video.src = videoSrc;
      }
    }

    return () => {
      hls?.destroy();
    };
  }, [videoSrc, isOfflineBlob]);

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
