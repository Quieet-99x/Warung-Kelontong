import { describe, expect, it } from "vitest";
import { buildPurchaseWhatsAppUrl } from "./purchase-whatsapp";

const purchase = {
  id: "r1",
  merchantName: "Toko Grosir Berkah",
  purchaseDate: "2026-08-30",
  items: [
    { id: "i1", itemName: "Minyakita 1L", qty: 12, unit: "Pcs", totalPrice: 168000, unitPrice: 14000, recommendedSellPrice: 16500 },
    { id: "i2", itemName: "Gula Pasir 1Kg", qty: 5, unit: "Pcs", totalPrice: 85000, unitPrice: 17000, recommendedSellPrice: 20000 },
  ],
  grandTotal: 253000,
  createdAt: "2026-08-30T10:00:00.000Z",
};

describe("purchase WhatsApp recap", () => {
  it("builds a numberless wa.me URL with complete receipt details", () => {
    const url = new URL(buildPurchaseWhatsAppUrl(purchase));
    const message = url.searchParams.get("text");
    expect(url.origin + url.pathname).toBe("https://wa.me/");
    expect(message).toContain("*REKAP KULAKAN*");
    expect(message).toContain("Toko Grosir Berkah");
    expect(message).toContain("30 Agu 2026");
    expect(message).toContain("12 Pcs × Rp14.000");
    expect(message).toContain("Subtotal: Rp168.000");
    expect(message).toContain("Rekomendasi jual: Rp16.500 / Pcs");
    expect(message).toContain("*TOTAL MODAL: Rp253.000*");
  });
});
