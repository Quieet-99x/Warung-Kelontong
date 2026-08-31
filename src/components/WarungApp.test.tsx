import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import WarungApp from "./WarungApp";

describe("Warung app navigation", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("opens the Kulakan module from bottom navigation", async () => {
    render(<WarungApp />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Kulakan" }));
    expect(screen.getByRole("heading", { name: "Rekap kulakan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pindai struk/i })).toBeInTheDocument();
  });

  it("prefills a new debt from the quick cashier calculator", async () => {
    render(<WarungApp />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "14000+26000+12500");
    expect(screen.getAllByText("Rp52.500").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: /Catat Jadi Kasbon/i }));
    expect(screen.getByRole("spinbutton", { name: "Total kasbon" })).toHaveValue(52500);
  });

  it("adds a cashier total to today's omzet without reloading", async () => {
    render(<WarungApp />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "52500");
    await userEvent.click(screen.getByRole("button", { name: /Tambah ke Omset Hari Ini/i }));
    await userEvent.click(screen.getByRole("button", { name: "Buku Kas" }));
    expect(screen.getByRole("spinbutton", { name: /Omset penjualan hari ini/i })).toHaveValue(52500);
  });

  it("saves today's closing to local storage", async () => {
    render(<WarungApp />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Buku Kas" }));
    await waitFor(() => expect(screen.getByRole("spinbutton", { name: /Omset penjualan hari ini/i })).toBeInTheDocument());
    await userEvent.clear(screen.getByRole("spinbutton", { name: /Omset penjualan hari ini/i }));
    await userEvent.type(screen.getByRole("spinbutton", { name: /Omset penjualan hari ini/i }), "125000");
    await userEvent.clear(screen.getByRole("spinbutton", { name: /Uang fisik di laci/i }));
    await userEvent.type(screen.getByRole("spinbutton", { name: /Uang fisik di laci/i }), "100000");
    await userEvent.click(screen.getByRole("button", { name: /Simpan & Tutup Buku/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/berhasil disimpan/i);
    const saved = JSON.parse(localStorage.getItem("daily_closings") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ manualIncome: 125000, cashInDrawer: 100000 });
  });

  it("shows saved receipt details and a WhatsApp recap action", async () => {
    localStorage.setItem("buku-kasbon.purchases.v1", JSON.stringify([{
      id: "r1", merchantName: "Grosir Berkah", purchaseDate: "2026-08-30", grandTotal: 30000,
      createdAt: "2026-08-30T10:00:00.000Z",
      items: [{ id: "i1", itemName: "Beras", qty: 2, unit: "Kg", totalPrice: 30000, unitPrice: 15000, recommendedSellPrice: 17500 }],
    }]));
    render(<WarungApp />);
    await userEvent.click(screen.getByRole("button", { name: "Kulakan" }));
    await waitFor(() => expect(screen.getByText("Grosir Berkah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Lihat detail Grosir Berkah/i }));
    expect(screen.getByText("Beras")).toBeInTheDocument();
    expect(screen.getByText(/2 Kg ×/)).toBeInTheDocument();
    const whatsapp = screen.getByRole("link", { name: /Rekap ke WhatsApp/i });
    expect(whatsapp).toHaveAttribute("href", expect.stringContaining("https://wa.me/?text="));
  });
});
