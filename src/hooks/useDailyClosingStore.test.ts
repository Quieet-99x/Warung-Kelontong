import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DAILY_CLOSINGS_KEY } from "@/lib/cashflow-storage";
import { useDailyClosingStore } from "./useDailyClosingStore";

const metrics = { paidDebtsToday: 0, totalExpenseToday: 0, newDebtsToday: 0 };

describe("useDailyClosingStore", () => {
  beforeEach(() => localStorage.clear());

  it("never overwrites an existing corrupt closing key", async () => {
    localStorage.setItem(DAILY_CLOSINGS_KEY, "corrupt");
    const { result } = renderHook(() => useDailyClosingStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => expect(result.current.addIncome("2026-08-31", 10_000, metrics)).toBe(false));
    expect(localStorage.getItem(DAILY_CLOSINGS_KEY)).toBe("corrupt");
  });

  it("accumulates rapid income additions without a stale-state lost update", async () => {
    const { result } = renderHook(() => useDailyClosingStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      expect(result.current.addIncome("2026-08-31", 10_000, metrics)).toBe(true);
      expect(result.current.addIncome("2026-08-31", 20_000, metrics)).toBe(true);
    });

    expect(result.current.closings).toHaveLength(1);
    expect(result.current.closings[0].manualIncome).toBe(30_000);
    expect(JSON.parse(localStorage.getItem(DAILY_CLOSINGS_KEY) ?? "[]")[0].manualIncome).toBe(30_000);
  });
});
