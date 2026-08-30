import { parseReceiptExtraction } from "./receipt";
import type { ScanImagePayload } from "./scan-request";

interface GeminiModels {
  generateContent(request: {
    model: string;
    contents: Array<{ role: "user"; parts: Array<{ inlineData?: ScanImagePayload; text?: string }> }>;
    config: Record<string, unknown>;
  }): Promise<{ text?: string }>;
}

const prompt = `Kamu adalah asisten akuntansi warung kelontong Indonesia. Baca foto nota/struk grosir, termasuk cetakan buram atau tulisan tangan, lalu ekstrak data secara presisi.
Aturan:
1. Perbaiki singkatan sembako umum: Myk menjadi Minyak, Tlr menjadi Telur, Brs menjadi Beras, Rkk menjadi Rokok.
2. Semua nominal adalah integer Rupiah tanpa pemisah ribuan.
3. Hitung unitPrice dari totalPrice dibagi qty bila tidak tercetak.
4. Jika tanggal benar-benar tidak terbaca, gunakan tanggal hari ini: ${new Date().toISOString().slice(0, 10)}.
5. Jangan mengarang item. Hanya masukkan baris yang terlihat pada struk.`;

const responseSchema = {
  type: "object",
  required: ["merchantName", "purchaseDate", "items", "grandTotal"],
  properties: {
    merchantName: { type: "string" },
    purchaseDate: { type: "string", description: "YYYY-MM-DD" },
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["itemName", "qty", "unit", "totalPrice", "unitPrice"],
        properties: {
          itemName: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
          totalPrice: { type: "integer" },
          unitPrice: { type: "integer" },
        },
      },
    },
    grandTotal: { type: "integer" },
  },
};

const defaultSleep = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

export async function extractReceiptWithGemini(
  image: ScanImagePayload,
  models: GeminiModels,
  model: string | string[],
  sleep: (milliseconds: number) => Promise<void> = defaultSleep,
) {
  const modelCandidates = Array.isArray(model) ? model : [model];
  let response: { text?: string } | undefined;
  let lastError: unknown;
  for (const candidate of modelCandidates) {
    const request = {
      model: candidate,
      contents: [{ role: "user" as const, parts: [{ inlineData: image }, { text: prompt }] }],
      config: { temperature: 0.1, responseMimeType: "application/json", responseSchema },
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await models.generateContent(request);
        break;
      } catch (error) {
        lastError = error;
        const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
        if (![429, 503, 504].includes(status)) throw error;
        if (attempt < 2) await sleep(400 * 2 ** attempt + Math.floor(Math.random() * 150));
      }
    }
    if (response) break;
  }
  if (!response) throw lastError;
  if (!response.text) throw new Error("Gemini tidak mengembalikan hasil scan");
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    throw new Error("Format hasil Gemini tidak valid");
  }
  return parseReceiptExtraction(parsed);
}
