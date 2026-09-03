import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ signIn: vi.fn() }));

import LoginScreen from "./LoginScreen";

afterEach(cleanup);

describe("LoginScreen", () => {
  it("explains local-only account storage before Google sign in", () => {
    render(<LoginScreen configured/>);
    expect(screen.getByRole("button", { name: "Masuk dengan Google" })).toBeInTheDocument();
    expect(screen.getByText(/tidak otomatis tersinkron/i)).toBeInTheDocument();
    expect(screen.getByText(/setiap akun dimulai kosong/i)).toBeInTheDocument();
  });

  it("fails closed when OAuth environment variables are missing", () => {
    render(<LoginScreen configured={false}/>);
    expect(screen.queryByRole("button", { name: "Masuk dengan Google" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("AUTH_GOOGLE_ID");
  });
});
