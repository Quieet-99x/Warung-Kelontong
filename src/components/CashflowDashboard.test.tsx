import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyClosingStore } from "@/hooks/useDailyClosingStore";
import CashflowDashboard from "./CashflowDashboard";

const { playKaching } = vi.hoisted(() => ({ playKaching: vi.fn() }));
vi.mock("@/lib/feedback", () => ({ feedback: { playKaching } }));

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
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-08-31T07:00:00.000Z"));
    playKaching.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows saved daily revenue and switches between bar and line charts", async () => {
    render(<CashflowDashboard debts={[]} receipts={[]} closingStore={closingStore}/>);

    expect(screen.getByRole("img", { name: /Grafik omset harian Agustus 2026/i })).toBeInTheDocument();
    expect(screen.getByText("PROGRES LAPORAN BULANAN")).toBeInTheDocument();
    expect(screen.getByText("Omzet Agustus 2026")).toBeInTheDocument();
    expect(document.querySelector(".revenue-chart-card h2, .revenue-chart-card h3")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Progres omzet Agustus 2026" })).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "Rp 175.000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bar" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Line" }));
    expect(screen.getByRole("button", { name: "Line" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector("polyline")).toBeInTheDocument();
    const points = [...document.querySelectorAll(".chart-point")];
    expect(Number(points[1].getAttribute("cx")) - Number(points[0].getAttribute("cx"))).toBeLessThan(20);
    expect(screen.getByText(/1 Agustus: Rp/)).toBeInTheDocument();
  });

  it("uses today's turnover statistics as the report hero without extra hero copy", () => {
    const store = {
      ...closingStore,
      closings: [...closingStore.closings, {
        id: "today", date: "2026-08-31", cashInDrawer: 125000, manualIncome: 125000,
        paidDebtsToday: 0, totalExpenseToday: 0, newDebtsToday: 0,
        netCashflow: 125000, closedAt: "2026-08-31T12:00:00.000Z",
      }],
    } as DailyClosingStore;
    render(<CashflowDashboard debts={[]} receipts={[]} closingStore={store}/>);

    const hero = document.querySelector(".cashflow-hero") as HTMLElement;
    const chart = hero.querySelector(".revenue-chart-card") as HTMLElement;
    const download = hero.querySelector(".download-financial") as HTMLElement;
    const copy = hero.querySelector(".cashflow-hero-copy") as HTMLElement;
    const headline = hero.querySelector("h1") as HTMLElement;
    expect(hero.dataset.theme).toBe("green");
    expect(copy.dataset.theme).toBe("green");
    expect(document.querySelectorAll(".revenue-chart-card")).toHaveLength(1);
    expect(document.querySelector(".monthly-cash-card .revenue-chart-card")).not.toBeInTheDocument();
    expect(chart.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(download.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(headline.textContent).toBe("BUKU KAS & LAPORAN");
    expect(hero).toHaveTextContent("Omzet hari ini");
    expect(hero).toHaveTextContent(/Rp\s*125\.000/);
    expect(hero).not.toHaveTextContent("Kasbon tertagih");
    expect(hero).toHaveTextContent("Belanja kulakan");
    expect(hero).not.toHaveTextContent("Buku kas warung");
    expect(hero).not.toHaveTextContent("Catat omset");
  });

  it("keeps the last valid month when the month picker is cleared", async () => {
    render(<CashflowDashboard debts={[]} receipts={[]} closingStore={closingStore}/>);
    const picker = screen.getByLabelText("Pilih bulan");

    await userEvent.clear(picker);

    expect(picker).toHaveValue("2026-08");
    expect(screen.getByRole("img", { name: /Grafik omset harian Agustus 2026/i })).toBeInTheDocument();
  });

  it("plays success feedback only after closing is saved", async () => {
    const store = { ...closingStore, closeBooks: vi.fn(() => true) } as DailyClosingStore;
    render(<CashflowDashboard debts={[]} receipts={[]} closingStore={store}/>);
    await userEvent.click(screen.getByRole("button", { name: /Simpan & Tutup Buku/i }));
    expect(playKaching).toHaveBeenCalledOnce();
  });
});
