export type DownloadProgress = (fraction: number) => void;

/** Stream the real transfer; decoding and installation complete the remaining 10%. */
export async function fetchAssetBuffer(url: string, signal: AbortSignal, onProgress?: DownloadProgress) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Asset request failed (${response.status}): ${url}`);
  const length = Number(response.headers.get('content-length'));
  // Content-Length refers to compressed bytes when Content-Encoding is present.
  const total = response.headers.get('content-encoding') ? 0 : length;
  if (!response.body || !onProgress) {
    const buffer = await response.arrayBuffer();
    onProgress?.(.9);
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); loaded += value.byteLength;
      if (total > 0) onProgress(Math.min(.9, loaded / total * .9));
    }
  } finally { reader.releaseLock(); }
  signal.throwIfAborted();
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  onProgress(.9);
  return bytes.buffer;
}
