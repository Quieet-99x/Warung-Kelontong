import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BackupModal from "./BackupModal";
import { buildCheckpoint } from "@/lib/backup";

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
});
