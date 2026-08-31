"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseStoredPurchases } from "@/lib/purchase-storage";
import type { PurchaseReceipt } from "@/types/receipt";

export const PURCHASES_KEY = "buku-kasbon.purchases.v1";

export function usePurchaseStore(writerEnabled = true) {
  const [purchases, setPurchases] = useState<PurchaseReceipt[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const purchasesRef = useRef<PurchaseReceipt[]>([]);
  const readyRef = useRef(false);
  const validRef = useRef(true);


  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem(PURCHASES_KEY);
      const stored = raw !== null ? parseStoredPurchases(raw) : [];
      if (!stored) { validRef.current = false; return; }
      validRef.current = true;
      purchasesRef.current = stored;
      setPurchases(stored);
    };
    const timer = window.setTimeout(() => {
      try { load(); } catch { validRef.current = false; }
      finally { readyRef.current = true; setHydrated(true); }
    }, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== PURCHASES_KEY) return;
      try { load(); } catch { validRef.current = false; }
    };
    window.addEventListener("storage", onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, []);

  const preparePurchase = useCallback((purchase: PurchaseReceipt) => purchasesRef.current.some(current => current.id === purchase.id)
    ? purchasesRef.current
    : [purchase, ...purchasesRef.current], []);
  const acceptCommittedPurchases = useCallback((next: PurchaseReceipt[]) => {
    purchasesRef.current = next;
    setPurchases(next);
  }, []);
  const savePurchase = useCallback((purchase: PurchaseReceipt) => {
    if (!writerEnabled || !readyRef.current || !validRef.current) return false;
    const next = preparePurchase(purchase);
    const serialized = JSON.stringify(next);
    try {
      localStorage.setItem(PURCHASES_KEY, serialized);
      if (localStorage.getItem(PURCHASES_KEY) !== serialized) throw new Error();
      acceptCommittedPurchases(next);
      return true;
    } catch {
      return false;
    }
  }, [acceptCommittedPurchases, preparePurchase, writerEnabled]);

  const canMutate = useCallback(() => writerEnabled && readyRef.current && validRef.current, [writerEnabled]);
  return { purchases, hydrated, savePurchase, preparePurchase, acceptCommittedPurchases, canMutate };
}
