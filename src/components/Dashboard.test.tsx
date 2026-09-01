import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

vi.mock("@/lib/qris-image", () => ({
  assertValidQrisUpload: vi.fn(),
  prepareQrisImage: vi.fn(async () => `data:image/jpeg;base64,${btoa("\xff\xd8\xffmock")}`),
}));
const { playKaching } = vi.hoisted(() => ({ playKaching: vi.fn() }));
vi.mock("@/lib/feedback", () => ({ feedback: { playKaching, playBeep: vi.fn(), triggerHaptic: vi.fn() } }));

describe("Dashboard forms", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:qris-preview") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    playKaching.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("accepts whole-rupiah amounts without an invalid step constraint", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());

    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);

    const amount = screen.getByRole("spinbutton", { name: "Total kasbon" });
    expect(amount).toHaveAttribute("min", "1");
    expect(amount).toHaveAttribute("step", "1");
    const phone = screen.getByRole("textbox", { name: "Nomor WhatsApp" });
    expect(phone).toHaveAttribute("pattern");
    await userEvent.type(phone, "+62 812-3456-7890");
    expect(phone).toBeValid();
    await userEvent.clear(phone);
    await userEvent.type(phone, "08----------12");
    expect(phone).toBeInvalid();
    await userEvent.clear(phone);
    await userEvent.type(phone, "abc081234567890xyz");
    expect(phone).toBeInvalid();
  });

  it("opens the data and backup center from store settings", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Pengaturan warung" }));
    await userEvent.click(screen.getByRole("button", { name: /Pusat Data & Cadangan/i }));
    expect(screen.getByRole("heading", { name: "Pusat Data & Cadangan" })).toBeInTheDocument();
  });

  it("processes and persists a QRIS image from store settings", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Pengaturan warung" }));
    await userEvent.upload(screen.getByLabelText(/Unggah foto QRIS/i), new File(["image"], "qris.png", { type: "image/png" }));
    expect(screen.getByLabelText("Atur crop QRIS")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gunakan hasil crop" }));
    await waitFor(() => expect(screen.getByRole("img", { name: /^Pratinjau QRIS$/i })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Simpan catatan" }));
    expect(JSON.parse(localStorage.getItem("buku-kasbon.store.v1") ?? "null").qrisImageBase64)
      .toBe(`data:image/jpeg;base64,${btoa("\xff\xd8\xffmock")}`);
  });

  it("keeps the save action visibly styled in the new debt modal", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);
    expect(screen.getByRole("button", { name: "Simpan catatan" })).toHaveClass("primary", "form-submit");
  });

  it("restores an unfinished debt after the component remounts", async () => {
    const first = render(<Dashboard/>);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);
    await userEvent.type(screen.getByRole("textbox", { name: "Nama pelanggan" }), "Siti");
    await userEvent.type(screen.getByRole("textbox", { name: "Barang yang diambil" }), "Beras");
    first.unmount();

    render(<Dashboard/>);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);
    expect(screen.getByRole("textbox", { name: "Nama pelanggan" })).toHaveValue("Siti");
    expect(screen.getByRole("textbox", { name: "Barang yang diambil" })).toHaveValue("Beras");
  });

  it("adds a purchase to an existing customer instead of creating another profile", async () => {
    localStorage.setItem("buku-kasbon.debts.v1", JSON.stringify([{
      id: "debt-1", customerName: "Siti", phoneNumber: "081234567890", itemsDescription: "Beras",
      totalAmount: 20_000, remainingAmount: 20_000, status: "UNPAID", createdAt: "2026-08-31T00:00:00.000Z", paymentHistory: [],
    }]));
    render(<Dashboard/>);
    await waitFor(() => expect(screen.getByText("Siti")).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);
    await userEvent.click(screen.getByRole("button", { name: /Pilih Siti/i }));
    await userEvent.type(screen.getByRole("textbox", { name: "Barang tambahan" }), "Minyak");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Nominal tambahan" }), "15000");
    await userEvent.click(screen.getByRole("button", { name: "Simpan catatan" }));
    const debts = JSON.parse(localStorage.getItem("buku-kasbon.debts.v1") ?? "[]");
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({ id: "debt-1", totalAmount: 35_000, remainingAmount: 35_000 });
  });

  it("keeps the form open and reports a storage failure", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);
    await userEvent.type(screen.getByRole("textbox", { name: "Nama pelanggan" }), "Siti");
    await userEvent.type(screen.getByRole("textbox", { name: "Nomor WhatsApp" }), "081234567890");
    await userEvent.type(screen.getByRole("textbox", { name: "Barang yang diambil" }), "Beras");
    await userEvent.type(screen.getByRole("spinbutton", { name: "Total kasbon" }), "10000");
    const original = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "buku-kasbon.debts.v1") throw new DOMException("blocked", "QuotaExceededError");
      return original.call(this, key, value);
    });

    await userEvent.click(screen.getByRole("button", { name: "Simpan catatan" }));

    expect(screen.getByRole("dialog", { name: "Catat kasbon baru" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/belum dapat disimpan/i);
    spy.mockRestore();
  });

  it("opens QRIS from payment without recording the payment", async () => {
    localStorage.setItem("buku-kasbon.store.v1", JSON.stringify({ storeName: "Warung Makmur", ownerName: "Rifki", qrisImageBase64: "data:image/png;base64,iVBORw0KGgptb2Nr" }));
    localStorage.setItem("buku-kasbon.debts.v1", JSON.stringify([{
      id: "debt-1", customerName: "Adit", phoneNumber: "081234567890", itemsDescription: "Minyak",
      totalAmount: 35000, remainingAmount: 35000, status: "UNPAID", createdAt: "2026-08-31T00:00:00.000Z", paymentHistory: [],
    }]));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Adit")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Bayar \/ Cicil/i }));
    await userEvent.type(screen.getByRole("spinbutton", { name: /Jumlah pembayaran/i }), "15000");
    await userEvent.click(screen.getByRole("button", { name: /Bayar via QRIS/i }));
    expect(screen.getByRole("dialog", { name: /Bayar pakai QRIS/i })).toHaveTextContent("Rp15.000");
    expect(JSON.parse(localStorage.getItem("buku-kasbon.debts.v1") ?? "[]")[0].remainingAmount).toBe(35000);
  });

  it("plays success feedback only when a debt becomes fully paid", async () => {
    localStorage.setItem("buku-kasbon.debts.v1", JSON.stringify([{
      id: "debt-1", customerName: "Adit", phoneNumber: "081234567890", itemsDescription: "Minyak",
      totalAmount: 35000, remainingAmount: 35000, status: "UNPAID", createdAt: "2026-08-31T00:00:00.000Z", paymentHistory: [],
    }]));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Adit")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Bayar \/ Cicil/i }));
    await userEvent.type(screen.getByRole("spinbutton", { name: /Jumlah pembayaran/i }), "35000");
    await userEvent.click(screen.getByRole("button", { name: "Simpan catatan" }));
    expect(playKaching).toHaveBeenCalledOnce();
  });

  it("deletes a debt only after explicit confirmation", async () => {
    localStorage.setItem("buku-kasbon.debts.v1", JSON.stringify([{
      id: "debt-1", customerName: "Adit", phoneNumber: "081234567890", itemsDescription: "Minyak dan susu",
      totalAmount: 35000, remainingAmount: 35000, status: "UNPAID", createdAt: "2026-08-31T00:00:00.000Z", paymentHistory: [],
    }]));
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Adit")).toBeInTheDocument());

    expect(screen.getByRole("link", { name: /Hubungi Adit via WhatsApp/i })).not.toContainElement(screen.queryByTestId("whatsapp-phone-icon"));
    await userEvent.click(screen.getByRole("button", { name: /Menu kasbon Adit/i }));
    await userEvent.click(screen.getByRole("button", { name: /Hapus kasbon/i }));
    expect(screen.getByText((_, element) => element?.textContent === "Hapus kasbon Adit sebesar Rp 35.000?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.getByText("Adit")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Menu kasbon Adit/i }));
    await userEvent.click(screen.getByRole("button", { name: /Hapus kasbon/i }));
    await userEvent.click(screen.getByRole("button", { name: "Ya, hapus kasbon" }));
    expect(screen.queryByText("Adit")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("buku-kasbon.debts.v1") ?? "null")).toEqual([]);
  });

  it("does not overwrite corrupt stored data during initial hydration", async () => {
    localStorage.setItem("buku-kasbon.debts.v1", "corrupt-data");
    render(<Dashboard />);

    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await new Promise(resolve => window.setTimeout(resolve, 20));
    expect(localStorage.getItem("buku-kasbon.debts.v1")).toBe("corrupt-data");
  });
});
