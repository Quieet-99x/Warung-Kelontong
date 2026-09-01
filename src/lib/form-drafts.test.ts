import { beforeEach, describe, expect, it } from "vitest";
import {
  DEBT_DRAFT_KEY,
  PURCHASE_DRAFT_KEY,
  clearFormDraft,
  readDebtDraft,
  readPurchaseDraft,
  writeFormDraft,
} from "./form-drafts";

const purchase = {
  draft: {
    merchantName: "Grosir Berkah",
    purchaseDate: "2026-08-31",
    grandTotal: 20_000,
    items: [{ id: "i1", itemName: "Beras", qty: 2, unit: "kg", unitPrice: 10_000, totalPrice: 20_000 }],
  },
  margin: 15,
  rounding: 500 as const,
  identity: { id: "r1", createdAt: "2026-08-31T10:00:00.000Z" },
};

describe("session form drafts", () => {
  beforeEach(() => sessionStorage.clear());

  it("round-trips valid debt and purchase drafts", () => {
    const debt = { name: "Siti", phone: "081234567890", items: "Beras", amount: "20000", due: "" };
    expect(writeFormDraft(DEBT_DRAFT_KEY, debt)).toBe(true);
    expect(writeFormDraft(PURCHASE_DRAFT_KEY, purchase)).toBe(true);
    expect(readDebtDraft()).toEqual(debt);
    expect(readPurchaseDraft()).toEqual(purchase);
  });

  it("rejects corrupt drafts without overwriting the raw evidence", () => {
    sessionStorage.setItem(DEBT_DRAFT_KEY, JSON.stringify({ name: 5 }));
    sessionStorage.setItem(PURCHASE_DRAFT_KEY, JSON.stringify({ draft: { items: [] } }));
    expect(readDebtDraft()).toBeNull();
    expect(readPurchaseDraft()).toBeNull();
    expect(sessionStorage.getItem(DEBT_DRAFT_KEY)).not.toBeNull();
  });

  it("clears a draft only when explicitly requested", () => {
    writeFormDraft(DEBT_DRAFT_KEY, { name: "Siti", phone: "", items: "", amount: "", due: "" });
    expect(clearFormDraft(DEBT_DRAFT_KEY)).toBe(true);
    expect(sessionStorage.getItem(DEBT_DRAFT_KEY)).toBeNull();
  });
});
