import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InventoryDashboard, { type InventoryStore } from "./InventoryDashboard";

const item = {
  id: "stock-1", name: "Minyakita 1L", currentStock: 2, unit: "pcs",
  lastCostPrice: 14000, minStockAlert: 3, updatedAt: "2026-08-31T10:00:00.000Z",
};

const createStore = (): InventoryStore => ({
  inventory: [item], logs: [], shoppingList: [], lowStock: [item], hydrated: true,
  storageIssue: "",
  addItem: vi.fn(() => true), adjustStock: vi.fn(() => true), editItem: vi.fn(() => true),
  syncPurchase: vi.fn(() => true), deductSale: vi.fn(() => true), addToShoppingList: vi.fn(() => true),
  toggleShoppingItem: vi.fn(() => true),
});

describe("InventoryDashboard", () => {
  beforeEach(cleanup);

  it("filters low stock and performs verified quick adjustments", async () => {
    const store = createStore();
    render(<InventoryDashboard store={store}/>);
    await userEvent.click(screen.getByRole("button", { name: /Stok menipis/i }));
    expect(screen.getByText("Minyakita 1L")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "-1" }));
    expect(store.adjustStock).toHaveBeenCalledWith("stock-1", -1, "Penyesuaian cepat -1");
    expect(screen.getByRole("status")).toHaveTextContent(/dikurangi 1/i);
  });

  it("adds a low-stock item to the shopping checklist", async () => {
    const store = createStore();
    render(<InventoryDashboard store={store}/>);
    await userEvent.click(screen.getByRole("button", { name: /Tambah ke checklist belanja/i }));
    expect(store.addToShoppingList).toHaveBeenCalledWith("stock-1");
    expect(screen.getByRole("status")).toHaveTextContent(/ditambahkan/i);
  });

  it("shows a save failure inside the active inventory dialog", async () => {
    const store = createStore();
    vi.mocked(store.addItem).mockReturnValue(false);
    render(<InventoryDashboard store={store}/>);
    await userEvent.click(screen.getByRole("button", { name: /Barang/i }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(screen.getByLabelText("Nama barang"), "Gula");
    await userEvent.click(screen.getByRole("button", { name: "Simpan stok" }));
    expect(dialog).toHaveTextContent(/belum dapat disimpan/i);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
