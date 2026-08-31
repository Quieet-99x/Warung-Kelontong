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
import type { DailyClosingRecord } from "@/types/cashflow";
import type { InventoryItem, ShoppingListItem, StockMovementLog } from "@/types/inventory";

const qrisImageBase64 = `data:image/png;base64,${btoa("\x89PNG\r\n\x1a\nmock")}`;
const store: StoreProfile = { storeName: "Warung Makmur", ownerName: "Rifki", paymentInfo: "BCA 123", qrisImageBase64 };
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
const closing: DailyClosingRecord = {
  id: "c1", date: "2026-08-30", cashInDrawer: 150000, manualIncome: 200000,
  paidDebtsToday: 50000, totalExpenseToday: 30000, newDebtsToday: 50000,
  netCashflow: 220000, notes: "Tutup normal", closedAt: "2026-08-30T21:00:00.000Z",
};
const inventory: InventoryItem = { id: "s1", name: "Beras", currentStock: 2, unit: "kg", lastCostPrice: 15000, minStockAlert: 3, updatedAt: "2026-08-30T12:00:00.000Z" };
const stockLog: StockMovementLog = { id: "l1", itemId: "s1", itemName: "Beras", changeQty: 2, type: "IN_PURCHASE", sourceId: "r1", date: "2026-08-30T12:00:00.000Z" };
const shoppingItem: ShoppingListItem = { id: "b1", inventoryItemId: "s1", itemName: "Beras", checked: false, createdAt: "2026-08-30T12:00:00.000Z" };

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
    const controlFormula = buildMonthlyCSV("2026-08", [{ ...debt, itemsDescription: "\ufeff=1+1" }], []);
    expect(controlFormula).toContain('"\'\ufeff=1+1"');
  });

  it("round-trips a versioned checkpoint through strict validation", () => {
    const text = buildCheckpoint({ storeProfile: store, debts: [debt], receipts: [receipt], inventory: [inventory], stockLogs: [stockLog], shoppingList: [shoppingItem] }, "2026-08-30T12:00:00.000Z");
    expect(parseCheckpoint(text)).toEqual({
      version: "4.0",
      backupDate: "2026-08-30T12:00:00.000Z",
      data: { storeProfile: store, debts: [debt], receipts: [receipt], dailyClosings: [], inventory: [inventory], stockLogs: [stockLog], shoppingList: [shoppingItem] },
    });
  });

  it("imports legacy v2 checkpoints with empty inventory", () => {
    const legacy = JSON.stringify({ version: "2.0", backupDate: "2026-08-30T12:00:00.000Z", data: { storeProfile: store, debts: [], receipts: [], dailyClosings: [] } });
    expect(parseCheckpoint(legacy)).toMatchObject({ version: "2.0", data: { inventory: [], stockLogs: [], shoppingList: [] } });
  });

  it("imports legacy v3 checkpoints without a QRIS image", () => {
    const legacyStore = { storeName: "Warung Lama", ownerName: "Rina", paymentInfo: "Tunai" };
    const legacy = JSON.stringify({ version: "3.0", backupDate: "2026-08-30T12:00:00.000Z", data: {
      storeProfile: legacyStore, debts: [], receipts: [], dailyClosings: [], inventory: [], stockLogs: [], shoppingList: [],
    } });
    expect(parseCheckpoint(legacy)).toMatchObject({ version: "3.0", data: { storeProfile: legacyStore } });
  });

  it("backs up daily closings in v4 and imports legacy v1 checkpoints", () => {
    const v3 = parseCheckpoint(buildCheckpoint({ storeProfile: store, debts: [], receipts: [], dailyClosings: [closing] }));
    expect(v3).toMatchObject({ version: "4.0", data: { dailyClosings: [closing] } });

    const legacy = JSON.stringify({
      version: "1.0", backupDate: "2026-08-30T12:00:00.000Z",
      data: { storeProfile: store, debts: [debt], receipts: [receipt] },
    });
    expect(parseCheckpoint(legacy)).toMatchObject({ version: "1.0", data: { dailyClosings: [] } });
  });

  it("rejects duplicate-date, inconsistent, and partially corrupt closings", () => {
    expect(() => parseCheckpoint(buildCheckpoint({
      storeProfile: store, debts: [], receipts: [], dailyClosings: [closing, { ...closing, id: "c2" }],
    }))).toThrow(/tidak valid/i);
    expect(() => parseCheckpoint(buildCheckpoint({
      storeProfile: store, debts: [], receipts: [], dailyClosings: [{ ...closing, netCashflow: 1 }],
    }))).toThrow(/tidak valid/i);
    const corruptStorage = {
      getItem: (key: string) => key === STORAGE_KEYS.dailyClosings ? JSON.stringify([closing, { id: "corrupt" }]) : null,
    };
    expect(() => readCurrentBackup(corruptStorage, { storeProfile: store, debts: [], receipts: [], dailyClosings: [] }))
      .toThrow(/tutup buku.*tidak valid/i);
  });

  it("rejects unsupported, oversized, and partially corrupt checkpoints", () => {
    const valid = JSON.parse(buildCheckpoint({ storeProfile: store, debts: [debt], receipts: [receipt] }));
    expect(() => parseCheckpoint(JSON.stringify({ ...valid, version: "5.0" }))).toThrow(/versi/i);
    valid.data.debts.push({ id: "corrupt" });
    expect(() => parseCheckpoint(JSON.stringify(valid))).toThrow(/tidak valid/i);
    const duplicate = JSON.parse(buildCheckpoint({ storeProfile: store, debts: [debt, debt], receipts: [receipt] }));
    expect(() => parseCheckpoint(JSON.stringify(duplicate))).toThrow(/tidak valid/i);
    expect(() => parseCheckpoint("x".repeat(5_000_001))).toThrow(/terlalu besar/i);
    expect(() => buildCheckpoint({
      storeProfile: store,
      debts: [debt],
      receipts: [{ ...receipt, rawImageUrl: "x".repeat(5_000_000) }],
    })).toThrow(/terlalu besar/i);
  });

  it("rejects duplicate payment IDs", () => {
    const paid = {
      ...debt,
      status: "PAID" as const,
      remainingAmount: 0,
      paymentHistory: [
        { id: "payment-1", amountPaid: 25000, paidAt: "2026-08-20T10:00:00.000Z" },
        { id: "payment-1", amountPaid: 25000, paidAt: "2026-08-21T10:00:00.000Z" },
      ],
    };
    expect(() => parseCheckpoint(buildCheckpoint({ storeProfile: store, debts: [paid], receipts: [] }))).toThrow(/tidak valid/i);
  });

  it("uses fallback only for missing keys and rejects existing corrupt storage", () => {
    const fallback = { storeProfile: store, debts: [debt], receipts: [receipt], dailyClosings: [], inventory: [], stockLogs: [], shoppingList: [] };
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
    const emptyExistingStorage = { getItem: (key: string) => key === STORAGE_KEYS.debts ? "" : null };
    expect(() => readCurrentBackup(emptyExistingStorage, fallback)).toThrow(/kasbon.*tidak valid/i);
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

  it("warns that storage may be inconsistent when rollback also fails", () => {
    const values = new Map<string, string>([
      [STORAGE_KEYS.store, "old-store"], [STORAGE_KEYS.debts, "old-debts"], [STORAGE_KEYS.receipts, "old-receipts"],
    ]);
    let failedRestore = false;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === STORAGE_KEYS.debts && !failedRestore) {
          failedRestore = true;
          throw new Error("restore failed");
        }
        if (failedRestore && key === STORAGE_KEYS.store && value === "old-store") throw new Error("rollback failed");
        values.set(key, value);
      },
      removeItem: (key: string) => { values.delete(key); },
    };
    expect(() => restoreCheckpoint(storage, { storeProfile: store, debts: [debt], receipts: [receipt] }))
      .toThrow(/mungkin tidak konsisten/i);
  });

  it("warns that storage may be inconsistent when rollback read-back throws", () => {
    let failedRestore = false;
    const values = new Map<string, string>([[STORAGE_KEYS.store, "old-store"]]);
    const storage = {
      getItem: (key: string) => {
        if (failedRestore) throw new Error("security");
        return values.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (key === STORAGE_KEYS.debts) { failedRestore = true; throw new Error("write"); }
        values.set(key, value);
      },
      removeItem: (key: string) => { values.delete(key); },
    };
    expect(() => restoreCheckpoint(storage, { storeProfile: store, debts: [debt], receipts: [receipt] }))
      .toThrow(/mungkin tidak konsisten/i);
  });

  it("rolls back when storage silently ignores a checkpoint write", () => {
    const values = new Map<string, string>([
      [STORAGE_KEYS.store, "old-store"], [STORAGE_KEYS.debts, "old-debts"], [STORAGE_KEYS.receipts, "old-receipts"],
    ]);
    let ignoreReceipt = true;
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === STORAGE_KEYS.receipts && ignoreReceipt) {
          ignoreReceipt = false;
          return;
        }
        values.set(key, value);
      },
      removeItem: (key: string) => { values.delete(key); },
    };
    expect(() => restoreCheckpoint(storage, { storeProfile: store, debts: [debt], receipts: [receipt] }))
      .toThrow(/berhasil dipertahankan/i);
    expect(Object.fromEntries(values)).toEqual({
      [STORAGE_KEYS.store]: "old-store",
      [STORAGE_KEYS.debts]: "old-debts",
      [STORAGE_KEYS.receipts]: "old-receipts",
    });
  });
});
