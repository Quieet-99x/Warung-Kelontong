"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addIncomeToDate, closeBooksForDate, DAILY_CLOSINGS_KEY, writeDailyClosings } from "@/lib/cashflow-storage";
import { parseStoredDailyClosings } from "@/lib/cashflow";
import type { DailyClosingRecord, DailyMetrics } from "@/types/cashflow";
import { newId } from "@/lib/utils";

export function useDailyClosingStore() {
  const [closings, setClosings] = useState<DailyClosingRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const recordsRef = useRef<DailyClosingRecord[]>([]);
  const readyRef = useRef(false);
  const validRef = useRef(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(DAILY_CLOSINGS_KEY);
        const parsed = raw ? parseStoredDailyClosings(raw) : null;
        if (raw && !parsed) validRef.current = false;
        if (parsed) {
          recordsRef.current = parsed;
          setClosings(parsed);
        }
      } catch {
        validRef.current = false;
      } finally {
        readyRef.current = true;
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const commit = useCallback((next: DailyClosingRecord[]) => {
    if (!readyRef.current || !validRef.current) return false;
    if (!writeDailyClosings(localStorage, next)) return false;
    recordsRef.current = next;
    setClosings(next);
    return true;
  }, []);

  const addIncome = useCallback((date: string, amount: number, metrics: DailyMetrics) => {
    try {
      return commit(addIncomeToDate(recordsRef.current, date, amount, metrics, newId(), new Date().toISOString()));
    } catch {
      return false;
    }
  }, [commit]);

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

  return { closings, hydrated, addIncome, closeBooks };
}

export type DailyClosingStore = ReturnType<typeof useDailyClosingStore>;
