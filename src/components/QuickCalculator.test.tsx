import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickCalculator from "./QuickCalculator";

const inventory = [
  { id: "stock-1", name: "Minyakita Goreng 1L", currentStock: 8, unit: "pcs", lastCostPrice: 0, minStockAlert: 2, updatedAt: "2026-08-31T10:00:00.000Z", baseBarcode: "8990001" },
  { id: "stock-2", name: "Indomie Goreng", currentStock: 12, unit: "pcs", lastCostPrice: 0, minStockAlert: 3, updatedAt: "2026-08-31T10:00:00.000Z" },
];

describe("QuickCalculator", () => {
  beforeEach(cleanup);
  it("shows an inline error for invalid expressions and disables actions", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "1/3");
    expect(screen.getByRole("alert")).toHaveTextContent(/tidak valid/i);
    expect(screen.getByRole("button", { name: "Tambahkan Kasbon" })).toBeDisabled();
  });

  it("orders completed order beside QRIS with debt below", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "52500");

    const actions = document.querySelector(".calculator-actions>div") as HTMLElement;
    const complete = screen.getByRole("button", { name: "Pesanan Selesai" });
    const qris = screen.getByRole("button", { name: "Tampilkan QRIS" });
    const debt = screen.getByRole("button", { name: "Tambahkan Kasbon" });
    expect(complete).toHaveClass("cashier-complete");
    expect(qris).toHaveClass("cashier-qris");
    expect(debt).toHaveClass("cashier-debt");
    expect([...actions.children]).toEqual([complete, qris, debt]);
  });

  it("removes cash shortcuts and places the payment summary after buyer cash", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "52500");
    expect(screen.queryByText("SHORTCUT UANG DITERIMA")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "50rb" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Uang pembeli" }), "50000");
    expect(screen.getByText("UANG MASIH KURANG")).toBeInTheDocument();
    expect(screen.getByText("Rp2.500")).toBeInTheDocument();
    expect(screen.getByText("TOTAL BELANJA").compareDocumentPosition(screen.getByText("UANG MASIH KURANG")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("uses comma, spaces, and a dash directly without an operator shortcut bar", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    const input = screen.getByRole("textbox", { name: /Total belanjaan/i });
    expect(screen.queryByRole("group", { name: /Operator kalkulator/i })).not.toBeInTheDocument();
    await userEvent.type(input, "14.000, 26.000 12.500 - 5.000");
    expect(input).toHaveValue("14.000, 26.000 12.500 - 5.000");
    expect(screen.getByText("Rp57.500")).toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the floating button", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => true}/>);
    const fab = screen.getByRole("button", { name: /Buka kalkulator kasir/i });
    await userEvent.click(fab);
    expect(screen.getByRole("textbox", { name: /Total belanjaan/i })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fab).toHaveFocus();
  });

  it("keeps a visible success status after adding omzet", async () => {
    const onAddIncome = vi.fn(() => true);
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={onAddIncome}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "52500");
    await userEvent.click(screen.getByRole("button", { name: "Pesanan Selesai" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Rp52.500.*ditambahkan/i);
  });

  it("opens static QRIS with the calculated total", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => true} store={{ storeName: "Warung Makmur", ownerName: "Rifki", qrisImageBase64: "data:image/png;base64,iVBORw0KGgptb2Nr" }}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "65000");
    await userEvent.click(screen.getByRole("button", { name: /Tampilkan QRIS/i }));
    expect(screen.getByRole("dialog", { name: /Bayar pakai QRIS/i })).toHaveTextContent("Rp65.000");
  });

  it("shows a failed storage status inside the open dialog", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => false}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "52500");
    await userEvent.click(screen.getByRole("button", { name: "Pesanan Selesai" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("status")).toHaveTextContent(/gagal disimpan/i);
  });

  it("does not steal focus when handing off to the debt modal", async () => {
    const debtInput = document.createElement("input");
    debtInput.setAttribute("aria-label", "Nama pelanggan kasbon");
    document.body.append(debtInput);
    render(<QuickCalculator onCreateDebt={() => debtInput.focus()} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "52500");
    await userEvent.click(screen.getByRole("button", { name: "Tambahkan Kasbon" }));
    await waitFor(() => expect(debtInput).toHaveFocus());
  });

  it("searches stock with typo suggestions instead of a product select", async () => {
    render(<QuickCalculator inventory={inventory} onCreateDebt={() => {}} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    expect(screen.queryByRole("combobox", { name: /Tambah barang dari stok/i })).not.toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "Cari barang dari stok" });
    await userEvent.type(search, "minykita");
    expect(screen.getByText(/Mungkin yang dimaksud/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Tambah Minyakita Goreng 1L/i }));
    expect(screen.getByLabelText("Jumlah Minyakita Goreng 1L")).toHaveValue(1);
  });

  it("scans a registered stock barcode into the cashier cart", async () => {
    render(<QuickCalculator inventory={inventory} onCreateDebt={() => {}} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.click(screen.getByRole("button", { name: "Scan barcode barang" }));
    await userEvent.type(screen.getByLabelText("Nomor barcode"), "8990001");
    await userEvent.click(screen.getByRole("button", { name: "Gunakan barcode" }));
    expect(screen.getByLabelText("Jumlah Minyakita Goreng 1L")).toHaveValue(1);
  });

  it("orders the simplified cashier workflow", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    const total = screen.getByRole("textbox", { name: "Total belanjaan" });
    const stock = screen.getByText("Barang dari stok");
    const buyerCash = screen.getByRole("textbox", { name: "Uang pembeli" });
    const summary = screen.getByText("TOTAL BELANJA");
    const actions = screen.getByText("AKSI CEPAT");
    expect(total.compareDocumentPosition(stock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stock.compareDocumentPosition(buyerCash) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(buyerCash.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("stacks total above change with a stronger total hierarchy", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    const summary = document.querySelector(".cashier-summary") as HTMLElement;
    const total = summary.querySelector(".cashier-total") as HTMLElement;
    const change = summary.querySelector(".change-card") as HTMLElement;
    expect(summary).toHaveClass("cashier-summary-stacked");
    expect([...summary.children]).toEqual([total, change]);
    expect(total.querySelector("strong")).toHaveClass("cashier-total-value");
    expect(change.querySelector("strong")).toHaveClass("cashier-change-value");
  });
});
