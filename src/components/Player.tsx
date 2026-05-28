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

  const download = async () => {
    if (!src) return;
    setDownloading(true);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]+/gi, "_")}.m3u8`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
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
          {stream ? `Streaming via ${stream.server.replace(/-$/, "")}` : "Pick an episode to start watching."}
        </p>
        <button
          onClick={download}
          disabled={!stream || downloading}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {downloading ? "Preparing…" : "Download"}
        </button>
      </div>
    </div>
  );
}
