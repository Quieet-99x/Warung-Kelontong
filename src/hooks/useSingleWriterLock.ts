"use client";

import { useEffect, useState } from "react";

export type WriterLockStatus = "checking" | "writer" | "readonly" | "unsupported";

export function useSingleWriterLock() {
  const [status, setStatus] = useState<WriterLockStatus>("checking");

  useEffect(() => {
    let mounted = true;
    let release: (() => void) | null = null;
    if (!navigator.locks) {
      queueMicrotask(() => { if (mounted) setStatus("unsupported"); });
      return () => { mounted = false; };
    }
    void navigator.locks.request("warung-kelontong-writer", { ifAvailable: true, mode: "exclusive" }, async lock => {
      if (!lock) {
        if (mounted) setStatus("readonly");
        return;
      }
      if (mounted) setStatus("writer");
      await new Promise<void>(resolve => { release = resolve; });
    }).catch(() => { if (mounted) setStatus("unsupported"); });
    return () => {
      mounted = false;
      release?.();
    };
  }, []);

  return { status, canWrite: status === "writer" } as const;
}
