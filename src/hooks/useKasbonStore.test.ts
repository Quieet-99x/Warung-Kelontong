import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DebtItem } from "@/types";
import { useKasbonStore } from "./useKasbonStore";

const debt: DebtItem = {
  id: "debt-1",
  customerName: "Adit",
  phoneNumber: "081234567890",
  itemsDescription: "Minyak dan susu",
  totalAmount: 35_000,
  remainingAmount: 35_000,
  status: "UNPAID",
  createdAt: "2026-08-31T00:00:00.000Z",
  paymentHistory: [],
};

const key = "buku-kasbon.debts.v1";

describe("useKasbonStore delete", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify([debt]));
  });

  it("does not overwrite an existing empty corrupt debt key", async () => {
    localStorage.setItem(key, "");
    const { result } = renderHook(() => useKasbonStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => expect(result.current.addDebt({ customerName: "Siti", phoneNumber: "081234567891", itemsDescription: "Beras", totalAmount: 10_000 })).toBe(false));

    expect(result.current.debts).toEqual([]);
    expect(localStorage.getItem(key)).toBe("");
  });

  it("removes a debt from storage before updating state", async () => {
    const { result } = renderHook(() => useKasbonStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => expect(result.current.deleteDebt(debt.id)).toBe(true));

    expect(result.current.debts).toEqual([]);
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual([]);
  });

  it("keeps the debt when storage cannot verify the deletion", async () => {
    const { result } = renderHook(() => useKasbonStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, storageKey, value) {
      if (storageKey === key) throw new DOMException("blocked", "QuotaExceededError");
      return originalSetItem.call(this, storageKey, value);
    });

    act(() => expect(result.current.deleteDebt(debt.id)).toBe(false));

    expect(result.current.debts).toEqual([debt]);
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual([debt]);
    vi.restoreAllMocks();
  });
});
