import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WarungApp from "./WarungApp";

describe("Warung app navigation", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: vi.fn(async (_name: string, _options: object, callback: (lock: object) => Promise<void>) => {
        await callback({});
      }),
    } });
  });

  it("keeps a second tab read-only when the writer lock is unavailable", async () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: vi.fn(async (_name: string, _options: object, callback: (lock: null) => void) => callback(null)),
    } });
    render(<WarungApp />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Mode baca saja.*tab lain/i);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);
    await userEvent.type(screen.getByRole("textbox", { name: "Nama pelanggan" }), "Siti");
    await userEvent.type(screen.getByRole("textbox", { name: "Nomor WhatsApp" }), "081234567890");
    await userEvent.type(screen.getByRole("textbox", { name: "Barang yang diambil" }), "Beras");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Total kasbon" }), "10000");
    await userEvent.click(screen.getByRole("button", { name: "Simpan catatan" }));
    expect(localStorage.getItem("buku-kasbon.debts.v1")).toBeNull();
  });

  it("opens the Kulakan module from bottom navigation", async () => {
    render(<WarungApp />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Kulakan" }));
    expect(screen.getByRole("heading", { name: "Rekap kulakan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pindai struk/i })).toBeInTheDocument();
  });

  it("opens inventory and shows low-stock items", async () => {
    localStorage.setItem("warung_inventory", JSON.stringify([{
      id: "stock-1", name: "Minyakita 1L", currentStock: 2, unit: "pcs",
      lastCostPrice: 14000, minStockAlert: 3, updatedAt: "2026-08-31T10:00:00.000Z",
    }]));
    localStorage.setItem("stock_logs", "[]");
    localStorage.setItem("warung_shopping_list", "[]");
    render(<WarungApp />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Stok" }));
    expect(screen.getByRole("heading", { name: /Manajemen stok/i })).toBeInTheDocument();
    expect(screen.getByText("Minyakita 1L")).toBeInTheDocument();
    expect(screen.getAllByText(/Stok menipis/i).length).toBeGreaterThan(0);
  });

  it("deducts selected inventory when a cashier sale is saved", async () => {
    localStorage.setItem("warung_inventory", JSON.stringify([{
      id: "stock-1", name: "Minyakita 1L", currentStock: 4, unit: "pcs",
      lastCostPrice: 14000, minStockAlert: 3, updatedAt: "2026-08-31T10:00:00.000Z",
    }]));
    localStorage.setItem("stock_logs", "[]");
    localStorage.setItem("warung_shopping_list", "[]");
    render(<WarungApp />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "28000");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /Tambah barang dari stok/i }), "stock-1");
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Jumlah Minyakita 1L" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Jumlah Minyakita 1L" }), "2");
    await userEvent.click(screen.getByRole("button", { name: /Tambah ke Omset Hari Ini/i }));
    expect(JSON.parse(localStorage.getItem("warung_inventory") ?? "[]")[0].currentStock).toBe(2);
    expect(JSON.parse(localStorage.getItem("stock_logs") ?? "[]")[0]).toMatchObject({ type: "OUT_CASH_SALE", changeQty: -2 });
  });

  it("deducts selected inventory when a new debt is saved", async () => {
    localStorage.setItem("warung_inventory", JSON.stringify([{
      id: "stock-1", name: "Minyakita 1L", currentStock: 4, unit: "pcs",
      lastCostPrice: 14000, minStockAlert: 3, updatedAt: "2026-08-31T10:00:00.000Z",
    }]));
    localStorage.setItem("stock_logs", "[]");
    localStorage.setItem("warung_shopping_list", "[]");
    render(<WarungApp />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);
    await userEvent.type(screen.getByRole("textbox", { name: "Nama pelanggan" }), "Siti");
    await userEvent.type(screen.getByRole("textbox", { name: "Nomor WhatsApp" }), "081234567890");
    await userEvent.type(screen.getByRole("textbox", { name: "Barang yang diambil" }), "Minyakita 1L");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /Tambah barang dari stok/i }), "stock-1");
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Jumlah Minyakita 1L" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Jumlah Minyakita 1L" }), "2");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Total kasbon" }), "28000");
    await userEvent.click(screen.getByRole("button", { name: "Simpan catatan" }));
    expect(JSON.parse(localStorage.getItem("warung_inventory") ?? "[]")[0].currentStock).toBe(2);
    expect(JSON.parse(localStorage.getItem("stock_logs") ?? "[]")[0]).toMatchObject({ type: "OUT_DEBT", changeQty: -2 });
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
