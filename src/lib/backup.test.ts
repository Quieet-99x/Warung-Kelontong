import { describe, expect, it } from "vitest";
import {
  buildCheckpoint,
  buildMonthlyCSV,
  parseCheckpoint,
  readCurrentBackup,
  restoreCheckpoint,
  STORAGE_KEYS,
} from "./backup";
import type { DebtItem, StoreProfile } from "@/types";
import type { PurchaseReceipt } from "@/types/receipt";

const store: StoreProfile = { storeName: "Warung Makmur", ownerName: "Rifki", paymentInfo: "BCA 123" };
const debt: DebtItem = {
  id: "d1", customerName: "Ibu, Siti", phoneNumber: "081234567890",
  itemsDescription: "=HYPERLINK(\"x\")", totalAmount: 50000, remainingAmount: 50000,
  status: "UNPAID", createdAt: "2026-08-12T10:00:00.000Z", paymentHistory: [],
};
const receipt: PurchaseReceipt = {
  id: "r1", merchantName: "Grosir \"Berkah\"", purchaseDate: "2026-08-15",
  createdAt: "2026-08-15T11:00:00.000Z", grandTotal: 30000,
  items: [{ id: "i1", itemName: "Beras", qty: 2, unit: "Kg", unitPrice: 15000, totalPrice: 30000, recommendedSellPrice: 17500 }],
};

describe("backup and recap engine", () => {
  it("builds a UTF-8 monthly CSV with filtered debts, purchases, and safe spreadsheet cells", () => {
    const otherDebt = { ...debt, id: "d2", createdAt: "2026-07-31T10:00:00.000Z", customerName: "Juli" };
    const csv = buildMonthlyCSV("2026-08", [debt, otherDebt], [receipt]);
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain("REKAP CATATAN WARUNG BULAN: 2026-08");
    expect(csv).toContain('"Ibu, Siti"');
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain('"Grosir ""Berkah"""');
    expect(csv).toContain('"Beras",2,"Kg",15000,30000');
    expect(csv).toContain('"Belum Lunas"');
    expect(csv).toContain("Total Kasbon Dicatat,50000");
    expect(csv).toContain("Total Pengeluaran Kulakan,30000");
    expect(csv).not.toContain("Juli");
  });

  it("round-trips a versioned checkpoint through strict validation", () => {
    const text = buildCheckpoint({ storeProfile: store, debts: [debt], receipts: [receipt] }, "2026-08-30T12:00:00.000Z");
    expect(parseCheckpoint(text)).toEqual({
      version: "1.0",
      backupDate: "2026-08-30T12:00:00.000Z",
      data: { storeProfile: store, debts: [debt], receipts: [receipt] },
    });
  });

  it("rejects unsupported, oversized, and partially corrupt checkpoints", () => {
    const valid = JSON.parse(buildCheckpoint({ storeProfile: store, debts: [debt], receipts: [receipt] }));
    expect(() => parseCheckpoint(JSON.stringify({ ...valid, version: "2.0" }))).toThrow(/versi/i);
    valid.data.debts.push({ id: "corrupt" });
    expect(() => parseCheckpoint(JSON.stringify(valid))).toThrow(/tidak valid/i);
    const duplicate = JSON.parse(buildCheckpoint({ storeProfile: store, debts: [debt, debt], receipts: [receipt] }));
    expect(() => parseCheckpoint(JSON.stringify(duplicate))).toThrow(/tidak valid/i);
    expect(() => parseCheckpoint("x".repeat(5_000_001))).toThrow(/terlalu besar/i);
  });

  it("uses fallback only for missing keys and rejects existing corrupt storage", () => {
    const fallback = { storeProfile: store, debts: [debt], receipts: [receipt] };
    const emptyStorage = { getItem: () => null };
    expect(readCurrentBackup(emptyStorage, fallback)).toEqual(fallback);
    const corruptStorage = {
      getItem: (key: string) => key === STORAGE_KEYS.debts ? "corrupt" : null,
    };
    expect(() => readCurrentBackup(corruptStorage, fallback)).toThrow(/tidak valid/i);
    const partiallyCorruptStorage = {
      getItem: (key: string) => key === STORAGE_KEYS.debts ? JSON.stringify([debt, { id: "corrupt" }]) : null,
    };
    expect(() => readCurrentBackup(partiallyCorruptStorage, fallback)).toThrow(/kasbon.*tidak valid/i);
  });

  it("restores all keys atomically and rolls back when a write fails", () => {
    const values = new Map<string, string>([
      [STORAGE_KEYS.store, "old-store"], [STORAGE_KEYS.debts, "old-debts"], [STORAGE_KEYS.receipts, "old-receipts"],
    ]);
    let writes = 0;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes += 1;
        if (writes === 2) throw new Error("quota");
        values.set(key, value);
      },
      removeItem: (key: string) => { values.delete(key); },
    };
    expect(() => restoreCheckpoint(storage, { storeProfile: store, debts: [debt], receipts: [receipt] })).toThrow(/gagal/i);
    expect(Object.fromEntries(values)).toEqual({
      [STORAGE_KEYS.store]: "old-store",
      [STORAGE_KEYS.debts]: "old-debts",
      [STORAGE_KEYS.receipts]: "old-receipts",
    });
  });
});
