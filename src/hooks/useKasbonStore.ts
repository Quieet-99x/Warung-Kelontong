"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DebtItem, StoreProfile } from "@/types";
import { addAmountToDebt, applyPayment, assertValidAmount } from "@/lib/debt";
import { parseStoredDebts, parseStoredStore } from "@/lib/storage";
import { newId } from "@/lib/utils";

export const DEBTS_KEY = "buku-kasbon.debts.v1";
const STORE_KEY = "buku-kasbon.store.v1";
const defaultStore: StoreProfile = { storeName: "Warung Makmur", ownerName: "Pemilik Warung", paymentInfo: "" };

export function useKasbonStore(writerEnabled = true) {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [store, setStoreState] = useState<StoreProfile>(defaultStore);
  const [hydrated, setHydrated] = useState(false);
  const debtsRef = useRef<DebtItem[]>([]);
  const readyRef = useRef(false);
  const validRef = useRef(true);

  useEffect(() => {
    const load = () => {
      const rawDebts = localStorage.getItem(DEBTS_KEY);
      const rawStore = localStorage.getItem(STORE_KEY);
      const storedDebts = rawDebts !== null ? parseStoredDebts(rawDebts) : [];
      const storedStore = rawStore !== null ? parseStoredStore(rawStore) : defaultStore;
      if (!storedDebts || !storedStore) { validRef.current = false; return; }
      validRef.current = true;
      debtsRef.current = storedDebts;
      setDebts(storedDebts);
      setStoreState(storedStore);
    };
    const timer = window.setTimeout(() => {
      try { load(); } catch { validRef.current = false; }
      finally { readyRef.current = true; setHydrated(true); }
    }, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== DEBTS_KEY && event.key !== STORE_KEY) return;
      try { load(); } catch { validRef.current = false; }
    };
    window.addEventListener("storage", onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, []);


  const commitDebts = useCallback((next: DebtItem[]) => {
    if (!writerEnabled || !readyRef.current || !validRef.current) return false;
    const serialized = JSON.stringify(next);
    let previous: string | null | undefined;
    try {
      previous = localStorage.getItem(DEBTS_KEY);
      localStorage.setItem(DEBTS_KEY, serialized);
      if (localStorage.getItem(DEBTS_KEY) !== serialized) throw new Error("Storage verification failed");
    } catch {
      try {
        if (typeof previous !== "undefined") {
          if (previous === null) localStorage.removeItem(DEBTS_KEY);
          else localStorage.setItem(DEBTS_KEY, previous);
        }
      } catch {}
      return false;
    }
    debtsRef.current = next;
    setDebts(next);
    return true;
  }, [writerEnabled]);

  const prepareDebt = useCallback((input: Omit<DebtItem, "id" | "remainingAmount" | "status" | "createdAt" | "paymentHistory">) => {
    assertValidAmount(input.totalAmount);
    const debt: DebtItem = {
      ...input,
      id: newId(),
      remainingAmount: input.totalAmount,
      status: "UNPAID",
      createdAt: new Date().toISOString(),
      paymentHistory: [],
    };
    return { debt, debts: [debt, ...debtsRef.current] };
  }, []);
  const acceptCommittedDebts = useCallback((next: DebtItem[]) => {
    debtsRef.current = next;
    setDebts(next);
  }, []);
  const addDebt = useCallback((input: Omit<DebtItem, "id" | "remainingAmount" | "status" | "createdAt" | "paymentHistory">) => {
    try { return commitDebts(prepareDebt(input).debts); }
    catch { return false; }
  }, [commitDebts, prepareDebt]);

  const addToDebt = useCallback((id: string, amount: number, description: string) => {
    try {
      return commitDebts(debtsRef.current.map(debt => debt.id === id ? addAmountToDebt(debt, amount, description) : debt));
    } catch {
      return false;
    }
  }, [commitDebts]);

  const prepareDebtIncrease = useCallback((id: string, amount: number, description: string) => {
    assertValidAmount(amount);
    if (!debtsRef.current.some(debt => debt.id === id)) throw new Error("Kasbon tidak ditemukan.");
    return debtsRef.current.map(debt => debt.id === id ? addAmountToDebt(debt, amount, description) : debt);
  }, []);

  const payDebt = useCallback((id: string, amount: number) => {
    try {
      return commitDebts(debtsRef.current.map(debt => debt.id === id ? applyPayment(debt, amount, newId(), new Date().toISOString()) : debt));
    } catch {
      return false;
    }
  }, [commitDebts]);

  const deleteDebt = useCallback((id: string) => {
    if (!debtsRef.current.some(debt => debt.id === id)) return false;
    return commitDebts(debtsRef.current.filter(debt => debt.id !== id));
  }, [commitDebts]);

  const setStore = useCallback((value: StoreProfile) => {
    if (!writerEnabled || !readyRef.current || !validRef.current) return false;
    const serialized = JSON.stringify(value);
    let previous: string | null | undefined;
    try {
      previous = localStorage.getItem(STORE_KEY);
      localStorage.setItem(STORE_KEY, serialized);
      if (localStorage.getItem(STORE_KEY) !== serialized) throw new Error("Storage verification failed");
    } catch {
      try {
        if (typeof previous !== "undefined") {
          if (previous === null) localStorage.removeItem(STORE_KEY);
          else localStorage.setItem(STORE_KEY, previous);
        }
      } catch {}
      return false;
    }
    setStoreState(value);
    return true;
  }, [writerEnabled]);
  const active = useMemo(() => debts.filter(debt => debt.status !== "PAID"), [debts]);
  const paid = useMemo(() => debts.filter(debt => debt.status === "PAID"), [debts]);
  const totalReceivable = useMemo(() => active.reduce((sum, debt) => sum + debt.remainingAmount, 0), [active]);

  const canMutate = useCallback(() => writerEnabled && readyRef.current && validRef.current, [writerEnabled]);
  return { debts, active, paid, store, hydrated, totalReceivable, addDebt, addToDebt, payDebt, deleteDebt, setStore, prepareDebt, prepareDebtIncrease, acceptCommittedDebts, canMutate };
}
