import type { EncodedArray, SliceResponse, UploadResponse } from "./types";

const BASE_URL = "http://localhost:8000";

export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const form = new FormData();
  for (const f of files) form.append("files", f);

  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function fetchSlice(
  uploadId: string,
  freqIdx: number,
): Promise<SliceResponse> {
  const res = await fetch(
    `${BASE_URL}/api/slice?upload_id=${encodeURIComponent(uploadId)}&freq_idx=${freqIdx}`,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Slice fetch failed (${res.status}): ${text}`);
  }
  return res.json();
}

export function decodeArray(enc: EncodedArray): Float32Array {
  const binary = atob(enc.data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}
