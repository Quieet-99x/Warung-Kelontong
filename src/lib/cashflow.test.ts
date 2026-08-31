import { describe, expect, it } from "vitest";
import type { DebtItem } from "@/types";
import type { DailyClosingRecord } from "@/types/cashflow";
import type { PurchaseReceipt } from "@/types/receipt";
import {
  buildCashflowMonthlyCSV,
  calculateDailyMetrics,
  calculateMonthlySummary,
  evaluateCashierExpression,
  parseStoredDailyClosings,
} from "./cashflow";

const debt: DebtItem = {
  id: "d1",
  customerName: "Siti",
  phoneNumber: "081234567890",
  itemsDescription: "Beras",
  totalAmount: 100_000,
  remainingAmount: 40_000,
  status: "PARTIAL",
  createdAt: "2026-08-30T08:00:00.000Z",
  paymentHistory: [
    { id: "p1", amountPaid: 40_000, paidAt: "2026-08-30T10:00:00.000Z" },
    { id: "p2", amountPaid: 20_000, paidAt: "2026-08-31T10:00:00.000Z" },
  ],
};

const receipt: PurchaseReceipt = {
  id: "r1",
  merchantName: "Grosir",
  purchaseDate: "2026-08-30",
  createdAt: "2026-08-30T09:00:00.000Z",
  grandTotal: 320_000,
  items: [{ id: "i1", itemName: "Beras", qty: 2, unit: "Karung", unitPrice: 160_000, totalPrice: 320_000 }],
};

const closing: DailyClosingRecord = {
  id: "c1",
  date: "2026-08-30",
  cashInDrawer: 1_450_000,
  manualIncome: 1_450_000,
  paidDebtsToday: 40_000,
  totalExpenseToday: 320_000,
  newDebtsToday: 100_000,
  netCashflow: 1_170_000,
  notes: "Ramai",
  closedAt: "2026-08-30T16:00:00.000Z",
};

describe("cashier expression", () => {
  it("evaluates rupiah arithmetic without eval", () => {
    expect(evaluateCashierExpression("14.000 + 26.000 + 12.500")).toBe(52_500);
    expect(evaluateCashierExpression("(10000 + 5000) * 2")).toBe(30_000);
    expect(evaluateCashierExpression("50.000 ÷ 2")).toBe(25_000);
  });

  it("rejects unsafe, malformed, fractional, or negative results", () => {
    for (const expression of ["alert(1)", "1e6", "1/3", "100-200", "", "9007199254740991+1"]) {
      expect(() => evaluateCashierExpression(expression)).toThrow(/tidak valid/i);
    }
  });

  it("accepts spaces and the Unicode minus produced by mobile keyboards", () => {
    expect(evaluateCashierExpression("50.000 − 5.000")).toBe(45_000);
  });
});

describe("cashflow calculations", () => {
  it("calculates daily automatic metrics by calendar date", () => {
    expect(calculateDailyMetrics("2026-08-30", [debt], [receipt])).toEqual({
      paidDebtsToday: 40_000,
      totalExpenseToday: 320_000,
      newDebtsToday: 100_000,
    });
  });

  it("calculates monthly omzet, purchases, profit, collections, and outstanding new debts", () => {
    expect(calculateMonthlySummary("2026-08", [closing], [receipt], [debt])).toEqual({
      monthYear: "2026-08",
      totalGrossIncome: 1_450_000,
      totalPurchases: 320_000,
      estimatedGrossProfit: 1_130_000,
      totalDebtsCollected: 60_000,
      totalNewDebts: 40_000,
    });
  });
});

describe("daily closing persistence", () => {
  it("accepts valid records and rejects one corrupt sibling all-or-nothing", () => {
    expect(parseStoredDailyClosings(JSON.stringify([closing]))).toEqual([closing]);
    expect(parseStoredDailyClosings(JSON.stringify([closing, { id: "bad" }]))).toBeNull();
    expect(parseStoredDailyClosings(JSON.stringify([closing, { ...closing }]))).toBeNull();
  });

  it("rejects inconsistent arithmetic and duplicate dates", () => {
    expect(parseStoredDailyClosings(JSON.stringify([{ ...closing, netCashflow: 1 }]))).toBeNull();
    expect(parseStoredDailyClosings(JSON.stringify([closing, { ...closing, id: "c2" }]))).toBeNull();
  });
});

describe("monthly cashflow CSV", () => {
  it("exports a UTF-8 human-readable summary with formula-safe notes", () => {
    const csv = buildCashflowMonthlyCSV("2026-08", [{ ...closing, notes: "=SUM(A1:A2)" }], [receipt], [debt]);
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain("Total Omset,1450000");
    expect(csv).toContain("Estimasi Laba Kotor,1130000");
    expect(csv).toContain("'=SUM(A1:A2)");
  });
});
