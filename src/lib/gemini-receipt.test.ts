import { describe, expect, it, vi } from "vitest";
import { extractReceiptWithGemini } from "./gemini-receipt";

const image = { mimeType: "image/jpeg" as const, data: "aW1hZ2U=" };
const result = {
  merchantName: "Grosir Berkah",
  purchaseDate: "2026-08-30",
  items: [{ itemName: "Beras", qty: 2, unit: "Kg", totalPrice: 30000, unitPrice: 15000 }],
  grandTotal: 30000,
};

describe("Gemini receipt extraction", () => {
  it("sends inline image with structured JSON configuration", async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: JSON.stringify(result) });
    await expect(extractReceiptWithGemini(image, { generateContent }, "gemini-3.7-flash")).resolves.toMatchObject(result);
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe("gemini-3.7-flash");
    expect(request.contents[0].parts[0]).toEqual({ inlineData: image });
    expect(request.config.responseMimeType).toBe("application/json");
    expect(request.config.temperature).toBe(0.1);
  });

  it("retries transient Gemini failures before succeeding", async () => {
    const generateContent = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("high demand"), { status: 503 }))
      .mockResolvedValue({ text: JSON.stringify(result) });
    await expect(extractReceiptWithGemini(image, { generateContent }, ["gemini-3.7-flash", "gemini-3.6-flash"], async () => {})).resolves.toMatchObject(result);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].model).toBe("gemini-3.7-flash");
  });

  it("falls back after the primary model stays unavailable", async () => {
    const unavailable = Object.assign(new Error("high demand"), { status: 503 });
    const generateContent = vi.fn()
      .mockRejectedValueOnce(unavailable)
      .mockRejectedValueOnce(unavailable)
      .mockRejectedValueOnce(unavailable)
      .mockResolvedValue({ text: JSON.stringify(result) });
    await expect(extractReceiptWithGemini(image, { generateContent }, ["gemini-3.7-flash", "gemini-3.6-flash"], async () => {})).resolves.toMatchObject(result);
    expect(generateContent).toHaveBeenCalledTimes(4);
    expect(generateContent.mock.calls[3][0].model).toBe("gemini-3.6-flash");
  });

  it("rejects malformed model output", async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: "{}" });
    await expect(extractReceiptWithGemini(image, { generateContent }, "gemini-3.7-flash")).rejects.toThrow();
  });
});
