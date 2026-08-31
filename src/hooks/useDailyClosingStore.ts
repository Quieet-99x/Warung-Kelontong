"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addIncomeToDate, closeBooksForDate, DAILY_CLOSINGS_KEY, writeDailyClosings } from "@/lib/cashflow-storage";
import { parseStoredDailyClosings } from "@/lib/cashflow";
import type { DailyClosingRecord, DailyMetrics } from "@/types/cashflow";
import { newId } from "@/lib/utils";

export function useDailyClosingStore(writerEnabled = true) {
  const [closings, setClosings] = useState<DailyClosingRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const recordsRef = useRef<DailyClosingRecord[]>([]);
  const readyRef = useRef(false);
  const validRef = useRef(true);

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem(DAILY_CLOSINGS_KEY);
      const parsed = raw !== null ? parseStoredDailyClosings(raw) : [];
      if (!parsed) { validRef.current = false; return; }
      validRef.current = true;
      recordsRef.current = parsed;
      setClosings(parsed);
    };
    const timer = window.setTimeout(() => {
      try { load(); } catch { validRef.current = false; }
      finally { readyRef.current = true; setHydrated(true); }
    }, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== DAILY_CLOSINGS_KEY) return;
      try { load(); } catch { validRef.current = false; }
    };
    window.addEventListener("storage", onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, []);

  const commit = useCallback((next: DailyClosingRecord[]) => {
    if (!writerEnabled || !readyRef.current || !validRef.current) return false;
    if (!writeDailyClosings(localStorage, next)) return false;
    recordsRef.current = next;
    setClosings(next);
    return true;
  }, [writerEnabled]);

  const addIncome = useCallback((date: string, amount: number, metrics: DailyMetrics) => {
    try {
      return commit(addIncomeToDate(recordsRef.current, date, amount, metrics, newId(), new Date().toISOString()));
    } catch {
      return false;
    }
  }, [commit]);
  const prepareIncome = useCallback((date: string, amount: number, metrics: DailyMetrics) =>
    addIncomeToDate(recordsRef.current, date, amount, metrics, newId(), new Date().toISOString()), []);
  const acceptCommittedClosings = useCallback((next: DailyClosingRecord[]) => {
    recordsRef.current = next;
    setClosings(next);
  }, []);

  const closeBooks = useCallback((input: {
    date: string;
    cashInDrawer: number;
    manualIncome: number;
    notes?: string;
    metrics: DailyMetrics;
  }) => {
    try {
      return commit(closeBooksForDate(recordsRef.current, { ...input, id: newId(), closedAt: new Date().toISOString() }));
    } catch {
      return false;
    }
  }, [commit]);

  const canMutate = useCallback(() => writerEnabled && readyRef.current && validRef.current, [writerEnabled]);
  return { closings, hydrated, addIncome, closeBooks, prepareIncome, acceptCommittedClosings, canMutate };
}

export type DailyClosingStore = ReturnType<typeof useDailyClosingStore>;
