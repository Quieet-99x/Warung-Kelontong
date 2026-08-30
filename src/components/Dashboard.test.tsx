import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import Dashboard from "./Dashboard";

describe("Dashboard forms", () => {
  beforeEach(() => localStorage.clear());

  it("accepts whole-rupiah amounts without an invalid step constraint", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());

    await userEvent.click(screen.getAllByRole("button", { name: "Catat kasbon" })[0]);

    const amount = screen.getByRole("spinbutton", { name: "Total kasbon" });
    expect(amount).toHaveAttribute("min", "1");
    expect(amount).toHaveAttribute("step", "1");
  });

  it("does not overwrite corrupt stored data during initial hydration", async () => {
    localStorage.setItem("buku-kasbon.debts.v1", "corrupt-data");
    render(<Dashboard />);

    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await new Promise(resolve => window.setTimeout(resolve, 20));
    expect(localStorage.getItem("buku-kasbon.debts.v1")).toBe("corrupt-data");
  });
});
