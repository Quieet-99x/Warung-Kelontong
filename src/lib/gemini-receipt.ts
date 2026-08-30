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

export async function extractReceiptWithGemini(image: ScanImagePayload, models: GeminiModels, model: string) {
  const response = await models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ inlineData: image }, { text: prompt }] }],
    config: { temperature: 0.1, responseMimeType: "application/json", responseSchema },
  });
  if (!response.text) throw new Error("Gemini tidak mengembalikan hasil scan");
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    throw new Error("Format hasil Gemini tidak valid");
  }
  return parseReceiptExtraction(parsed);
}
