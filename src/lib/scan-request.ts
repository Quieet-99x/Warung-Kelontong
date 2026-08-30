const MAX_IMAGE_BYTES = 800 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export interface ScanImagePayload {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
}

const hasImageSignature = (mimeType: string, data: string): boolean => {
  const bytes = Uint8Array.from(atob(data.slice(0, 32)), character => character.charCodeAt(0));
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
};

export function parseScanRequest(value: unknown): ScanImagePayload {
  if (typeof value !== "object" || value === null || !("image" in value) || typeof value.image !== "string") {
    throw new Error("Foto struk wajib dikirim");
  }
  const match = DATA_URL.exec(value.image);
  if (!match) throw new Error("Format foto harus JPEG, PNG, atau WebP");
  const [, mimeType, data] = match;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor(data.length * 3 / 4) - padding;
  if (decodedBytes > MAX_IMAGE_BYTES) throw new Error("Ukuran foto maksimal 800 KB");
  if (!hasImageSignature(mimeType, data)) throw new Error("Isi foto tidak sesuai format gambar");
  return { mimeType: mimeType as ScanImagePayload["mimeType"], data };
}
