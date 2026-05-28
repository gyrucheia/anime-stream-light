import Hls from "hls.js";
import { Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Stream, proxiedM3U8 } from "@/lib/api";

export function Player({
  stream,
  title,
}: {
  stream: Stream | null;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState(0);

  const src = stream ? proxiedM3U8(stream.url, stream.referer) : "";

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }
    return () => {
      hls?.destroy();
    };
  }, [src]);

  /**
   * Download the current episode as a single offline-playable .ts file.
   *
   * Strategy (Option C — fully client-side, no backend changes):
   *  1. Fetch the proxied .m3u8 playlist text.
   *  2. If it's a master playlist (#EXT-X-STREAM-INF), resolve the first
   *     variant and fetch that media playlist instead.
   *  3. Extract every .ts segment URL, resolving relative paths against the
   *     playlist base URL so they always go through the proxy.
   *  4. Fetch segments sequentially, collecting ArrayBuffers.
   *  5. Concatenate into one Blob (video/mp2t) and trigger a browser download.
   *
   * The resulting .ts file is a standard MPEG-TS stream playable in VLC,
   * MPV, or any modern browser — no network connection required after saving.
   */
  const download = async () => {
    if (!src || !stream) return;
    setDownloading(true);
    setDlProgress(0);

    try {
      // ── Step 1: Fetch the top-level playlist ───────────────────────────
      const topRes = await fetch(src);
      if (!topRes.ok) throw new Error(`Playlist fetch failed: ${topRes.status}`);
      const topText = await topRes.text();

      // ── Step 2: Resolve master → media playlist if needed ─────────────
      let mediaText = topText;
      let mediaBaseUrl = src;

      if (topText.includes("#EXT-X-STREAM-INF")) {
        // Master playlist — pick the first (often highest) variant
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
        .map((l) =>
          l.startsWith("http") ? l : new URL(l, mediaBaseUrl).href,
        );

      if (!segmentUrls.length) {
        throw new Error("No segments found in playlist.");
      }

      // ── Step 4: Fetch segments sequentially through the proxy ──────────
      const buffers: ArrayBuffer[] = [];
      for (let i = 0; i < segmentUrls.length; i++) {
        const segRes = await fetch(segmentUrls[i]);
        if (!segRes.ok) throw new Error(`Segment ${i + 1} failed: ${segRes.status}`);
        buffers.push(await segRes.arrayBuffer());
        setDlProgress(Math.round(((i + 1) / segmentUrls.length) * 100));
      }

      // ── Step 5: Concatenate and save ───────────────────────────────────
      const blob = new Blob(buffers, { type: "video/mp2t" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${title.replace(/[^a-z0-9]+/gi, "_")}.ts`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("[Player] Download failed:", err);
    } finally {
      setDownloading(false);
      setDlProgress(0);
    }
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
            disabled={!stream || downloading}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {downloading ? `Downloading ${dlProgress}%` : "Download"}
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
