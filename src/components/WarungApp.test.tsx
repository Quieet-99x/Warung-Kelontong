import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import WarungApp from "./WarungApp";

describe("Warung app navigation", () => {
  beforeEach(() => localStorage.clear());

  it("opens the Kulakan module from bottom navigation", async () => {
    render(<WarungApp />);
    await waitFor(() => expect(screen.getByText("Kelola kasbon dengan mudah")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Kulakan" }));
    expect(screen.getByRole("heading", { name: "Rekap kulakan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scan struk/i })).toBeInTheDocument();
  });
});
