"use client";

import { useCallback, useEffect, useState } from "react";
import { parseStoredPurchases } from "@/lib/purchase-storage";
import type { PurchaseReceipt } from "@/types/receipt";

const PURCHASES_KEY = "buku-kasbon.purchases.v1";

export function usePurchaseStore() {
  const [purchases, setPurchases] = useState<PurchaseReceipt[]>([]);
  const [hydrated, setHydrated] = useState(false);


  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(PURCHASES_KEY);
        const stored = raw ? parseStoredPurchases(raw) : null;
        if (stored) setPurchases(stored);
      } catch {
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const savePurchase = useCallback((purchase: PurchaseReceipt) => {
    const next = [purchase, ...purchases];
    try {
      localStorage.setItem(PURCHASES_KEY, JSON.stringify(next));
      setPurchases(next);
      return true;
    } catch {
      return false;
    }
  }, [purchases]);

  return { purchases, hydrated, savePurchase };
}
