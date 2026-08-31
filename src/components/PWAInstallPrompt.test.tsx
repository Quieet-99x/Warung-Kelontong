import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PWAInstallPrompt from "./PWAInstallPrompt";

describe("PWAInstallPrompt", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: vi.fn(async () => ({ update: vi.fn() })) } });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  });

  it("offers the native install prompt when available", async () => {
    const prompt = vi.fn(async () => {});
    render(<PWAInstallPrompt/>);
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }) });
    window.dispatchEvent(event);
    await userEvent.click(await screen.findByRole("button", { name: /Pasang aplikasi/i }));
    expect(prompt).toHaveBeenCalledOnce();
  });

  it("shows an explicit update action when a new deployment is detected", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: "old" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: "new" }), { status: 200 }));
    render(<PWAInstallPrompt/>);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(await screen.findByRole("button", { name: /Perbarui sekarang/i })).toBeInTheDocument();
    fetchMock.mockRestore();
  });
});
