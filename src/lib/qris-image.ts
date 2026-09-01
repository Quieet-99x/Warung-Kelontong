import { MAX_QRIS_DATA_URL_LENGTH } from "./storage";

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_UPLOAD_BYTES = 10_000_000;
const MAX_DIMENSION = 1200;

export interface QrisCrop { zoom: number; x: number; y: number }

export function calculateSquareCrop(width: number, height: number, crop: QrisCrop) {
  const base = Math.min(width, height);
  const zoom = Math.min(3, Math.max(1, crop.zoom));
  const size = base / zoom;
  const maxX = width - size;
  const maxY = height - size;
  const normalizedX = Math.min(1, Math.max(-1, crop.x));
  const normalizedY = Math.min(1, Math.max(-1, crop.y));
  return {
    sx: Math.round((normalizedX + 1) / 2 * maxX),
    sy: Math.round((normalizedY + 1) / 2 * maxY),
    size: Math.round(size),
  };
}

export function calculateCropPreviewGeometry(width: number, height: number, crop: QrisCrop) {
  const source = calculateSquareCrop(width, height, crop);
  return {
    widthPercent: width / source.size * 100,
    heightPercent: height / source.size * 100,
    leftPercent: -source.sx / source.size * 100,
    topPercent: -source.sy / source.size * 100,
  };
}

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

export async function prepareQrisImage(file: File, crop: QrisCrop = { zoom: 1, x: 0, y: 0 }): Promise<string> {
  assertValidQrisUpload(file);
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Dimensi gambar QRIS tidak valid.");
  const source = calculateSquareCrop(image.naturalWidth, image.naturalHeight, crop);
  const outputSize = Math.min(MAX_DIMENSION, source.size);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, outputSize);
  canvas.height = Math.max(1, outputSize);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser tidak dapat memproses gambar QRIS.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, source.sx, source.sy, source.size, source.size, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.92, 0.84, 0.76, 0.68, 0.6]) {
    const value = canvas.toDataURL("image/jpeg", quality);
    if (value.length <= MAX_QRIS_DATA_URL_LENGTH) return value;
  }
  throw new Error("Gambar QRIS masih terlalu besar setelah dikompresi. Gunakan gambar yang lebih kecil.");
}
