const DB_NAME = "gyrucheia_offline_db";
const STORE_NAME = "videos";

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in browser contexts"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVideoBlob(id: string, blob: Blob): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getVideoBlob(id: string): Promise<Blob | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to read from IndexedDB:", err);
    return null;
  }
}

export async function deleteVideoBlob(id: string): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to delete from IndexedDB:", err);
  }
}

// ── Per-segment storage (new format) ──────────────────────────────────────────
// Episodes are stored as N individual segment blobs + a metadata record.
// This prevents loading a monolithic 200–500 MB ArrayBuffer on mobile;
// HLS.js instead fetches each ~5 MB segment on-demand as it buffers ahead.

export interface OfflineEpisodeMeta {
  segmentCount: number;
  durations: number[]; // EXTINF duration per segment, in seconds
}

export async function saveEpisodeMeta(id: string, meta: OfflineEpisodeMeta): Promise<void> {
  const blob = new Blob([JSON.stringify(meta)], { type: "application/json" });
  await saveVideoBlob(`${id}_meta`, blob);
}

export async function getEpisodeMeta(id: string): Promise<OfflineEpisodeMeta | null> {
  try {
    const blob = await getVideoBlob(`${id}_meta`);
    if (!blob) return null;
    const text = await blob.text();
    return JSON.parse(text) as OfflineEpisodeMeta;
  } catch {
    return null;
  }
}

export async function saveSegmentBlob(id: string, index: number, blob: Blob): Promise<void> {
  await saveVideoBlob(`${id}_seg_${index}`, blob);
}

export async function getSegmentBlob(id: string, index: number): Promise<Blob | null> {
  return getVideoBlob(`${id}_seg_${index}`);
}

/**
 * Deletes all IndexedDB records for an episode:
 * the metadata blob, every segment blob, and the old-style monolithic blob (if any).
 */
export async function deleteEpisodeAll(id: string): Promise<void> {
  try {
    const meta = await getEpisodeMeta(id);
    if (meta) {
      for (let i = 0; i < meta.segmentCount; i++) {
        await deleteVideoBlob(`${id}_seg_${i}`);
      }
      await deleteVideoBlob(`${id}_meta`);
    }
    // Also clean up old-format monolithic blob if it exists
    await deleteVideoBlob(id);
  } catch (err) {
    console.error("Failed to delete episode from IndexedDB:", err);
  }
}
