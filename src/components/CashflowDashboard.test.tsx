import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyClosingStore } from "@/hooks/useDailyClosingStore";
import CashflowDashboard from "./CashflowDashboard";

const closingStore = {
  hydrated: true,
  closings: [
    { id: "c1", date: "2026-08-01", cashInDrawer: 100000, manualIncome: 100000, paidDebtsToday: 0, totalExpenseToday: 0, newDebtsToday: 0, netCashflow: 100000, closedAt: "2026-08-01T12:00:00.000Z" },
    { id: "c2", date: "2026-08-02", cashInDrawer: 175000, manualIncome: 175000, paidDebtsToday: 0, totalExpenseToday: 0, newDebtsToday: 0, netCashflow: 175000, closedAt: "2026-08-02T12:00:00.000Z" },
  ],
  addIncome: vi.fn(),
  closeBooks: vi.fn(),
} as unknown as DailyClosingStore;

describe("CashflowDashboard monthly revenue chart", () => {
  beforeEach(() => vi.setSystemTime(new Date("2026-08-31T07:00:00.000Z")));
  afterEach(() => vi.useRealTimers());

  it("shows saved daily revenue and switches between bar and line charts", async () => {
    render(<CashflowDashboard debts={[]} receipts={[]} closingStore={closingStore}/>);

    expect(screen.getByRole("img", { name: /Grafik omset harian Agustus 2026/i })).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "Rp 175.000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bar" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Line" }));
    expect(screen.getByRole("button", { name: "Line" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector("polyline")).toBeInTheDocument();
  });
});
