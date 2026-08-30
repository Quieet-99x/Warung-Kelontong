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
    expect(screen.getByRole("button", { name: /Scan struk/i })).toBeInTheDocument();
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
