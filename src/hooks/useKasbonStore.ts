"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DebtItem, StoreProfile } from "@/types";
import { addAmountToDebt, applyPayment, assertValidAmount } from "@/lib/debt";
import { parseStoredDebts, parseStoredStore } from "@/lib/storage";
import { newId } from "@/lib/utils";

const DEBTS_KEY = "buku-kasbon.debts.v1";
const STORE_KEY = "buku-kasbon.store.v1";
const defaultStore: StoreProfile = { storeName: "Warung Makmur", ownerName: "Pemilik Warung", paymentInfo: "" };

export function useKasbonStore() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [store, setStoreState] = useState<StoreProfile>(defaultStore);
  const [hydrated, setHydrated] = useState(false);
  const debtsRef = useRef<DebtItem[]>([]);
  const readyRef = useRef(false);
  const validRef = useRef(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const rawDebts = localStorage.getItem(DEBTS_KEY);
        const rawStore = localStorage.getItem(STORE_KEY);
        const storedDebts = rawDebts !== null ? parseStoredDebts(rawDebts) : null;
        const storedStore = rawStore !== null ? parseStoredStore(rawStore) : null;
        if ((rawDebts !== null && !storedDebts) || (rawStore !== null && !storedStore)) validRef.current = false;
        if (storedDebts) {
          debtsRef.current = storedDebts;
          setDebts(storedDebts);
        }
        if (storedStore) setStoreState(storedStore);
      } catch {
        validRef.current = false;
      } finally {
        readyRef.current = true;
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);


  const commitDebts = useCallback((next: DebtItem[]) => {
    if (!readyRef.current || !validRef.current) return false;
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
  }, []);

  const addDebt = useCallback((input: Omit<DebtItem, "id" | "remainingAmount" | "status" | "createdAt" | "paymentHistory">) => {
    assertValidAmount(input.totalAmount);
    return commitDebts([{
      ...input,
      id: newId(),
      remainingAmount: input.totalAmount,
      status: "UNPAID",
      createdAt: new Date().toISOString(),
      paymentHistory: [],
    }, ...debtsRef.current]);
  }, [commitDebts]);

  const addToDebt = useCallback((id: string, amount: number, description: string) => {
    try {
      return commitDebts(debtsRef.current.map(debt => debt.id === id ? addAmountToDebt(debt, amount, description) : debt));
    } catch {
      return false;
    }
  }, [commitDebts]);

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
    if (!readyRef.current || !validRef.current) return false;
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
  }, []);
  const active = useMemo(() => debts.filter(debt => debt.status !== "PAID"), [debts]);
  const paid = useMemo(() => debts.filter(debt => debt.status === "PAID"), [debts]);
  const totalReceivable = useMemo(() => active.reduce((sum, debt) => sum + debt.remainingAmount, 0), [active]);

  return { debts, active, paid, store, hydrated, totalReceivable, addDebt, addToDebt, payDebt, deleteDebt, setStore };
}
