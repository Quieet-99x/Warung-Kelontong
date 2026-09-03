import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSingleWriterLock } from "./useSingleWriterLock";

describe("useSingleWriterLock", () => {
  it("renders a deterministic checking state during SSR", () => {
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: undefined });

    const LockStatus = () => createElement("span", null, useSingleWriterLock().status);
    try {
      expect(renderToString(createElement(LockStatus))).toContain("checking");
    } finally {
      if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    }
  });

  it("holds an exclusive lock until unmount", async () => {
    let releaseRequest!: () => void;
    const request = vi.fn((_name: string, _options: object, callback: (lock: object) => Promise<void>) => {
      void callback({}).then(() => releaseRequest());
      return new Promise<void>(resolve => { releaseRequest = resolve; });
    });
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
    const { result, unmount } = renderHook(() => useSingleWriterLock());
    await waitFor(() => expect(result.current.status).toBe("writer"));
    expect(result.current.canWrite).toBe(true);
    act(unmount);
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
  });

  it("isolates writer locks by account", async () => {
    const request = vi.fn(async (_name: string, _options: object, callback: (lock: object) => Promise<void>) => callback({}));
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
    const { result } = renderHook(() => useSingleWriterLock("google-user-a"));
    await waitFor(() => expect(result.current.status).toBe("writer"));
    expect(request).toHaveBeenCalledWith("warung-kelontong-writer:google-user-a", expect.any(Object), expect.any(Function));
  });

  it("makes a second tab read-only when the lock is unavailable", async () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_name: string, _options: object, callback: (lock: null) => void) => callback(null)) } });
    const { result } = renderHook(() => useSingleWriterLock());
    await waitFor(() => expect(result.current.status).toBe("readonly"));
    expect(result.current.canWrite).toBe(false);
  });

  it("fails closed when Web Locks is unsupported", async () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
    const { result } = renderHook(() => useSingleWriterLock());
    await waitFor(() => expect(result.current.status).toBe("unsupported"));
    expect(result.current.canWrite).toBe(false);
  });
});
