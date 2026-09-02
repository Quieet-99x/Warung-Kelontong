import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickCalculator from "./QuickCalculator";

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

  it("uses payment shortcuts as absolute cash options", async () => {
    render(<QuickCalculator onCreateDebt={() => {}} onAddIncome={() => true}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /Total belanjaan/i }), "52500");
    expect(screen.queryByRole("button", { name: /\+50rb/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "50rb" }));
    expect(screen.getByRole("textbox", { name: /Uang diterima pembeli/i })).toHaveValue("50000");
    expect(screen.getByText("UANG MASIH KURANG")).toBeInTheDocument();
    expect(screen.getByText("Rp2.500")).toBeInTheDocument();
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

  it("adds a scanned wholesale barcode with package price and base-unit stock quantity", async () => {
    const inventory = [{ id: "i1", name: "Indomie", currentStock: 80, unit: "Pcs", lastCostPrice: 3000, minStockAlert: 10, updatedAt: "2026-09-02T10:00:00.000Z", baseBarcode: "8990000000001", baseSellPrice: 3500, alternateUnits: [{ id: "dus", name: "Dus" as const, barcode: "18990000000008", conversion: 40, lastCostPrice: 115000, sellPrice: 130000 }] }];
    const onAddIncome = vi.fn(() => true);
    render(<QuickCalculator inventory={inventory} onCreateDebt={() => {}} onAddIncome={onAddIncome}/>);
    await userEvent.click(screen.getByRole("button", { name: /Buka kalkulator kasir/i }));
    await userEvent.click(screen.getByRole("button", { name: "Scan barcode barang" }));
    await userEvent.type(screen.getByLabelText("Nomor barcode"), "18990000000008");
    await userEvent.click(screen.getByRole("button", { name: "Gunakan barcode" }));
    expect(screen.getByText("1 Dus × 40 Pcs")).toBeInTheDocument();
    expect(screen.getAllByText(/Rp\s*130\.000/)).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Pesanan Selesai" }));
    expect(onAddIncome).toHaveBeenCalledWith(130000, [expect.objectContaining({ itemId: "i1", qtySold: 40, unitName: "Dus", packageQty: 1 })]);
  });
});
