import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BackupModal from "./BackupModal";
import { APPLICATION_RESET_SIGNAL_KEY, buildCheckpoint, SESSION_STORAGE_KEYS, STORAGE_KEYS } from "@/lib/backup";

const storeProfile = { storeName: "Warung Makmur", ownerName: "Rifki", paymentInfo: "" };
const debt = {
  id: "d1", customerName: "Siti", phoneNumber: "081234567890", itemsDescription: "Beras",
  totalAmount: 50000, remainingAmount: 50000, status: "UNPAID" as const,
  createdAt: "2026-08-12T10:00:00.000Z", paymentHistory: [],
};
const receipt = {
  id: "r1", merchantName: "Grosir", purchaseDate: "2026-08-15", createdAt: "2026-08-15T11:00:00.000Z",
  grandTotal: 30000, items: [{ id: "i1", itemName: "Beras", qty: 2, unit: "Kg", unitPrice: 15000, totalPrice: 30000, recommendedSellPrice: 17500 }],
};

describe("BackupModal", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows monthly recap and checkpoint actions", () => {
    render(<BackupModal open onClose={() => {}} storeProfile={storeProfile} debts={[debt]} onRestored={() => {}} />);
    expect(screen.getByRole("heading", { name: "Pusat Data & Cadangan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download Rekap Excel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download Checkpoint/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Pilih file checkpoint/i)).toHaveAttribute("accept", ".json,application/json");
  });

  it("previews a valid checkpoint and requires explicit confirmation before restore", async () => {
    const onRestored = vi.fn();
    render(<BackupModal open onClose={() => {}} storeProfile={storeProfile} debts={[]} onRestored={onRestored} />);
    const file = new File([
      buildCheckpoint({ storeProfile, debts: [debt], receipts: [receipt] }, "2026-08-30T12:00:00.000Z"),
    ], "backup.json", { type: "application/json" });
    await userEvent.upload(screen.getByLabelText(/Pilih file checkpoint/i), file);
    await waitFor(() => expect(screen.getByText(/Cadangan.*Warung Makmur/i)).toBeInTheDocument());
    expect(screen.getByText(/1 kasbon · 1 struk/i)).toBeInTheDocument();
    expect(onRestored).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Ya, Pulihkan Data/i }));
    expect(onRestored).toHaveBeenCalledOnce();
  });

  it("rejects an invalid checkpoint without showing the destructive confirmation", async () => {
    render(<BackupModal open onClose={() => {}} storeProfile={storeProfile} debts={[]} onRestored={() => {}} />);
    await userEvent.upload(screen.getByLabelText(/Pilih file checkpoint/i), new File(["{}"], "bad.json", { type: "application/json" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/gagal membaca checkpoint/i);
    expect(screen.queryByRole("button", { name: /Ya, Pulihkan Data/i })).not.toBeInTheDocument();
  });

  it("requires two approval stages and the exact RESET phrase before clearing application data", async () => {
    const onRestored = vi.fn();
    for (const key of Object.values(STORAGE_KEYS)) localStorage.setItem(key, `saved-${key}`);
    for (const key of Object.values(SESSION_STORAGE_KEYS)) sessionStorage.setItem(key, `draft-${key}`);
    localStorage.setItem("other-app", "keep-local");
    sessionStorage.setItem("other-session", "keep-session");
    render(<BackupModal open onClose={() => {}} storeProfile={storeProfile} debts={[debt]} onRestored={onRestored} canReset />);

    await userEvent.click(screen.getByRole("button", { name: "Reset seluruh data" }));
    const initialHeading = screen.getByRole("heading", { name: "Reset seluruh data?" });
    expect(initialHeading).toHaveFocus();
    expect(initialHeading.closest("section")).toHaveAttribute("role", "status");
    expect(onRestored).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.debts)).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Lanjutkan reset" }));
    expect(screen.getByLabelText(/Ketik RESET/i)).toHaveFocus();
    const finalButton = screen.getByRole("button", { name: "Reset seluruh data sekarang" });
    expect(finalButton).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Ketik RESET/i), "reset");
    expect(finalButton).toBeDisabled();
    await userEvent.clear(screen.getByLabelText(/Ketik RESET/i));
    await userEvent.type(screen.getByLabelText(/Ketik RESET/i), "RESET");
    expect(finalButton).toBeEnabled();
    await userEvent.click(finalButton);

    expect(Object.values(STORAGE_KEYS).every(key => localStorage.getItem(key) === null)).toBe(true);
    expect(Object.values(SESSION_STORAGE_KEYS).every(key => sessionStorage.getItem(key) === null)).toBe(true);
    expect(localStorage.getItem("other-app")).toBe("keep-local");
    expect(sessionStorage.getItem("other-session")).toBe("keep-session");
    expect(localStorage.getItem(APPLICATION_RESET_SIGNAL_KEY)).toBeNull();
    expect(onRestored).toHaveBeenCalledOnce();
  });

  it("cancels final approval without changing stored data", async () => {
    localStorage.setItem(STORAGE_KEYS.debts, "saved-debts");
    render(<BackupModal open onClose={() => {}} storeProfile={storeProfile} debts={[]} onRestored={() => {}} canReset />);
    await userEvent.click(screen.getByRole("button", { name: "Reset seluruh data" }));
    await userEvent.click(screen.getByRole("button", { name: "Lanjutkan reset" }));
    await userEvent.type(screen.getByLabelText(/Ketik RESET/i), "RESET");
    await userEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.queryByRole("button", { name: "Reset seluruh data sekarang" })).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEYS.debts)).toBe("saved-debts");
  });

  it("starts approval from the beginning after the data center is closed and reopened", async () => {
    const props = { onClose: () => {}, storeProfile, debts: [], onRestored: () => {}, canReset: true };
    const view = render(<BackupModal open {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Reset seluruh data" }));
    await userEvent.click(screen.getByRole("button", { name: "Lanjutkan reset" }));
    await userEvent.type(screen.getByLabelText(/Ketik RESET/i), "RESET");
    await userEvent.click(screen.getByRole("button", { name: "Tutup" }));
    view.rerender(<BackupModal open={false} {...props} />);
    view.rerender(<BackupModal open {...props} />);
    expect(screen.queryByRole("button", { name: "Reset seluruh data sekarang" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset seluruh data" })).toBeEnabled();
  });

  it("keeps data and reports an error when reset storage removal fails", async () => {
    const onRestored = vi.fn();
    localStorage.setItem(STORAGE_KEYS.store, "saved-store");
    localStorage.setItem(STORAGE_KEYS.debts, "saved-debts");
    const originalRemove = Storage.prototype.removeItem;
    let failed = false;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key) {
      if (this === localStorage && key === STORAGE_KEYS.debts && !failed) { failed = true; throw new Error("blocked"); }
      originalRemove.call(this, key);
    });
    render(<BackupModal open onClose={() => {}} storeProfile={storeProfile} debts={[]} onRestored={onRestored} canReset />);
    await userEvent.click(screen.getByRole("button", { name: "Reset seluruh data" }));
    await userEvent.click(screen.getByRole("button", { name: "Lanjutkan reset" }));
    await userEvent.type(screen.getByLabelText(/Ketik RESET/i), "RESET");
    await userEvent.click(screen.getByRole("button", { name: "Reset seluruh data sekarang" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/berhasil dipertahankan/i);
    expect(localStorage.getItem(STORAGE_KEYS.store)).toBe("saved-store");
    expect(localStorage.getItem(STORAGE_KEYS.debts)).toBe("saved-debts");
    expect(onRestored).not.toHaveBeenCalled();
  });

  it("reports completed deletion accurately when automatic reload fails", async () => {
    localStorage.setItem(STORAGE_KEYS.store, "saved-store");
    render(<BackupModal open onClose={() => {}} storeProfile={storeProfile} debts={[]} onRestored={() => { throw new Error("reload blocked"); }} canReset />);
    await userEvent.click(screen.getByRole("button", { name: "Reset seluruh data" }));
    await userEvent.click(screen.getByRole("button", { name: "Lanjutkan reset" }));
    await userEvent.type(screen.getByLabelText(/Ketik RESET/i), "RESET");
    await userEvent.click(screen.getByRole("button", { name: "Reset seluruh data sekarang" }));
    expect(localStorage.getItem(STORAGE_KEYS.store)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/berhasil direset/i);
    expect(screen.getByRole("status")).toHaveTextContent(/muat ulang.*manual/i);
    expect(screen.queryByText(/Reset data gagal/i)).not.toBeInTheDocument();
  });

  it("warns before reloading when other tabs cannot be notified", async () => {
    const onRestored = vi.fn();
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const originalSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (this === localStorage && key === APPLICATION_RESET_SIGNAL_KEY) throw new Error("broadcast blocked");
      originalSet.call(this, key, value);
    });
    render(<BackupModal open onClose={() => {}} storeProfile={storeProfile} debts={[]} onRestored={onRestored} canReset />);
    await userEvent.click(screen.getByRole("button", { name: "Reset seluruh data" }));
    await userEvent.click(screen.getByRole("button", { name: "Lanjutkan reset" }));
    await userEvent.type(screen.getByLabelText(/Ketik RESET/i), "RESET");
    await userEvent.click(screen.getByRole("button", { name: "Reset seluruh data sekarang" }));

    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/tab aplikasi lain/i));
    expect(alert.mock.invocationCallOrder[0]).toBeLessThan(onRestored.mock.invocationCallOrder[0]);
    expect(onRestored).toHaveBeenCalledOnce();
  });

  it("does not offer reset without write authority", () => {
    render(<BackupModal open onClose={() => {}} storeProfile={storeProfile} debts={[]} onRestored={() => {}} canReset={false} />);
    expect(screen.getByRole("button", { name: "Reset seluruh data" })).toBeDisabled();
  });
});
