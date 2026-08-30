import { describe, expect, it } from "vitest";
import type { DailyMetrics } from "@/types/cashflow";
import { addIncomeToDate, closeBooksForDate, writeDailyClosings } from "./cashflow-storage";

const metrics: DailyMetrics = { paidDebtsToday: 40_000, totalExpenseToday: 320_000, newDebtsToday: 100_000 };

describe("daily closing mutations", () => {
  it("accumulates cashier sales into one daily record", () => {
    const first = addIncomeToDate([], "2026-08-30", 52_500, metrics, "id-1", "2026-08-30T10:00:00.000Z");
    const second = addIncomeToDate(first, "2026-08-30", 20_000, metrics, "unused", "2026-08-30T11:00:00.000Z");
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ id: "id-1", manualIncome: 72_500, netCashflow: -207_500 });
  });

  it("closes or updates the same date with physical cash and notes", () => {
    const initial = addIncomeToDate([], "2026-08-30", 52_500, metrics, "id-1", "2026-08-30T10:00:00.000Z");
    const closed = closeBooksForDate(initial, {
      date: "2026-08-30",
      cashInDrawer: 1_450_000,
      manualIncome: 80_000,
      notes: "Ramai",
      metrics,
      id: "unused",
      closedAt: "2026-08-30T16:00:00.000Z",
    });
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ id: "id-1", cashInDrawer: 1_450_000, manualIncome: 80_000, notes: "Ramai", netCashflow: -200_000 });
  });

  it("returns false when browser storage rejects or silently ignores a write", () => {
    const rejecting = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(writeDailyClosings(rejecting, [])).toBe(false);
    const ignoring = { getItem: () => null, setItem: () => undefined };
    expect(writeDailyClosings(ignoring, [])).toBe(false);
  });
});
