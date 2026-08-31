import { MAX_QRIS_DATA_URL_LENGTH } from "./storage";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_UPLOAD_BYTES = 10_000_000;
const MAX_DIMENSION = 1200;

export function assertValidQrisUpload(file: File): void {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error("Gunakan gambar QRIS berformat PNG, JPEG, atau WebP.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Ukuran gambar QRIS maksimal 10 MB.");
  if (file.size === 0) throw new Error("File gambar QRIS kosong.");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar QRIS tidak dapat dibaca.")); };
    image.src = url;
  });
}

export async function prepareQrisImage(file: File): Promise<string> {
  assertValidQrisUpload(file);
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Dimensi gambar QRIS tidak valid.");
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser tidak dapat memproses gambar QRIS.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.92, 0.84, 0.76, 0.68, 0.6]) {
    const value = canvas.toDataURL("image/jpeg", quality);
    if (value.length <= MAX_QRIS_DATA_URL_LENGTH) return value;
  }
  throw new Error("Gambar QRIS masih terlalu besar setelah dikompresi. Gunakan gambar yang lebih kecil.");
}
