import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSingleWriterLock } from "./useSingleWriterLock";

describe("useSingleWriterLock", () => {
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
