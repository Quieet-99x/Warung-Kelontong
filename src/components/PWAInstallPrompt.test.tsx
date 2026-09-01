import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PWAInstallPrompt from "./PWAInstallPrompt";

describe("PWAInstallPrompt", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: vi.fn(async () => ({ update: vi.fn() })) } });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  });

  it("offers the native install prompt when available", async () => {
    const prompt = vi.fn(async () => {});
    render(<PWAInstallPrompt/>);
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }) });
    window.dispatchEvent(event);
    expect(await screen.findByRole("dialog", { name: /Pasang Buku Warung/i })).toHaveClass("pwa-install-modal");
    await userEvent.click(await screen.findByRole("button", { name: /Pasang aplikasi/i }));
    expect(prompt).toHaveBeenCalledOnce();
  });

  it("contains focus, restores it, and remembers dismissal for the session", async () => {
    render(<><button type="button">Buka bantuan</button><PWAInstallPrompt/></>);
    const trigger = screen.getByRole("button", { name: "Buka bantuan" });
    trigger.focus();
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }) });
    window.dispatchEvent(event);
    const close = await screen.findByRole("button", { name: /Tutup panduan pemasangan/i });
    const install = screen.getByRole("button", { name: /Pasang aplikasi/i });
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(install).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.click(close);
    expect(screen.queryByRole("dialog", { name: /Pasang Buku Warung/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    cleanup();
    render(<PWAInstallPrompt/>);
    window.dispatchEvent(event);
    expect(screen.queryByRole("dialog", { name: /Pasang Buku Warung/i })).not.toBeInTheDocument();
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

  it("releases modal focus containment when an update banner takes priority", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: "old" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: "new" }), { status: 200 }));
    render(<PWAInstallPrompt/>);
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }) });
    window.dispatchEvent(event);
    expect(await screen.findByRole("dialog", { name: /Pasang Buku Warung/i })).toBeInTheDocument();
    document.dispatchEvent(new Event("visibilitychange"));
    const update = await screen.findByRole("button", { name: /Perbarui sekarang/i });
    expect(screen.queryByRole("dialog", { name: /Pasang Buku Warung/i })).not.toBeInTheDocument();
    update.focus();
    expect(update).toHaveFocus();
    fetchMock.mockRestore();
  });
});
