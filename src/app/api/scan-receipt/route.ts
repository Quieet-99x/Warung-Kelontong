import { GoogleGenAI } from "@google/genai";
import { extractReceiptWithGemini } from "@/lib/gemini-receipt";
import { checkOrigin, createRateLimiter, readLimitedBody } from "@/lib/scan-api-protection";
import { parseScanRequest } from "@/lib/scan-request";

export const runtime = "nodejs";
export const maxDuration = 30;
const MAX_REQUEST_BYTES = 1_200_000;
const allowRequest = createRateLimiter(10, 60 * 60 * 1000);

export async function POST(request: Request) {
  try {
    if (!checkOrigin(request)) return Response.json({ error: "Permintaan ditolak." }, { status: 403 });
    const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!allowRequest(client)) return Response.json({ error: "Batas scan tercapai. Coba lagi nanti." }, { status: 429 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Fitur scan belum dikonfigurasi oleh pemilik warung." }, { status: 503 });
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return Response.json({ error: "Ukuran permintaan terlalu besar." }, { status: 413 });
    }
    let rawBody: string;
    try {
      rawBody = await readLimitedBody(request, MAX_REQUEST_BYTES);
    } catch {
      return Response.json({ error: "Ukuran permintaan terlalu besar." }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
    }
    const image = parseScanRequest(body);
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || "gemini-3.7-flash";
    const receipt = await extractReceiptWithGemini(image, ai.models, model);
    return Response.json({ receipt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membaca struk";
    const invalidRequest = /foto|format|800 KB/i.test(message);
    const rateLimited = /429|quota|rate limit/i.test(message);
    return Response.json(
      { error: rateLimited ? "Kuota scan gratis sedang penuh. Coba lagi beberapa saat." : invalidRequest ? message : "Struk belum dapat dibaca. Coba foto ulang dengan cahaya lebih jelas." },
      { status: rateLimited ? 429 : invalidRequest ? 400 : 502 },
    );
  }
}
