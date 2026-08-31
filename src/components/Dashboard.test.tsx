import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import Dashboard from "./Dashboard";

describe("Dashboard forms", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

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

  it("keeps the save action visibly styled in the new debt modal", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);
    expect(screen.getByRole("button", { name: "Simpan catatan" })).toHaveClass("primary", "form-submit");
  });

  it("does not overwrite corrupt stored data during initial hydration", async () => {
    localStorage.setItem("buku-kasbon.debts.v1", "corrupt-data");
    render(<Dashboard />);

    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await new Promise(resolve => window.setTimeout(resolve, 20));
    expect(localStorage.getItem("buku-kasbon.debts.v1")).toBe("corrupt-data");
  });
});
