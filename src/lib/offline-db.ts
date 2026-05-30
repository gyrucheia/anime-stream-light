// Deprecated: Offline IndexedDB storage is no longer used.
// All downloads now save directly to the device's native storage.

export interface OfflineEpisodeMeta {
  segmentCount: number;
  durations: number[];
}

export async function saveVideoBlob(id: string, blob: Blob): Promise<void> {}
export async function getVideoBlob(id: string): Promise<Blob | null> { return null; }
export async function deleteVideoBlob(id: string): Promise<void> {}
export async function saveEpisodeMeta(id: string, meta: OfflineEpisodeMeta): Promise<void> {}
export async function getEpisodeMeta(id: string): Promise<OfflineEpisodeMeta | null> { return null; }
export async function saveSegmentBlob(id: string, index: number, blob: Blob): Promise<void> {}
export async function getSegmentBlob(id: string, index: number): Promise<Blob | null> { return null; }
export async function deleteEpisodeAll(id: string): Promise<void> {}
