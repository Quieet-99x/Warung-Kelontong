import { cleanup, render, screen, within } from "@testing-library/react";
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
  toggleShoppingItem: vi.fn(() => true), removeShoppingItem: vi.fn(() => true),
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

  it("keeps low-stock and shopping actions as compact icons beside the stock total", async () => {
    const store = createStore();
    render(<InventoryDashboard store={store}/>);
    const card = screen.getByRole("article", { name: /Minyakita 1L/i });
    const stockBar = within(card).getByLabelText("Sisa stok 2 pcs");
    const warning = within(card).getByRole("img", { name: "Stok menipis, batas minimum 3 pcs" });
    const shopping = within(card).getByRole("button", { name: /Tambah Minyakita 1L ke checklist belanja/i });

    expect(stockBar).toContainElement(warning);
    expect(stockBar).toContainElement(shopping);
    expect(within(card).queryByText("Tambah ke checklist belanja")).not.toBeInTheDocument();
    await userEvent.click(shopping);
    expect(store.addToShoppingList).toHaveBeenCalledWith("stock-1");
    expect(screen.getByRole("status")).toHaveTextContent(/ditambahkan/i);
  });

  it("deletes a shopping item only after confirmation", async () => {
    const store = createStore();
    store.shoppingList = [{ id: "shop-1", inventoryItemId: "stock-1", itemName: "Minyakita 1L", checked: false, createdAt: "2026-08-31T10:00:00.000Z" }];
    render(<InventoryDashboard store={store}/>);

    await userEvent.click(screen.getByRole("button", { name: "Hapus Minyakita 1L dari checklist belanja" }));
    expect(store.removeShoppingItem).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Hapus item belanja?" });
    expect(dialog).toHaveTextContent("Minyakita 1L");
    await userEvent.click(within(dialog).getByRole("button", { name: "Hapus item" }));

    expect(store.removeShoppingItem).toHaveBeenCalledWith("shop-1");
    expect(screen.getByRole("status")).toHaveTextContent("Minyakita 1L dihapus dari checklist belanja.");
  });

  it("keeps the delete confirmation open when shopping-list persistence fails", async () => {
    const store = createStore();
    store.shoppingList = [{ id: "shop-1", inventoryItemId: "stock-1", itemName: "Minyakita 1L", checked: false, createdAt: "2026-08-31T10:00:00.000Z" }];
    vi.mocked(store.removeShoppingItem).mockReturnValue(false);
    render(<InventoryDashboard store={store}/>);

    await userEvent.click(screen.getByRole("button", { name: "Hapus Minyakita 1L dari checklist belanja" }));
    await userEvent.click(screen.getByRole("button", { name: "Hapus item" }));

    expect(screen.getByRole("dialog", { name: "Hapus item belanja?" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/belum dapat dihapus/i);
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
