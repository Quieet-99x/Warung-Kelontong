"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasValidInventoryReferences, INVENTORY_KEYS, MAX_STOCK_QUANTITY, parseStoredInventory, parseStoredShoppingList, parseStoredStockLogs } from "@/lib/inventory-storage";
import { deductStockFromSale, syncStockFromPurchase } from "@/lib/inventory-sync";
import { commitStorageTransaction, StorageInconsistentError } from "@/lib/storage-transaction";
import { newId } from "@/lib/utils";
import type { InventoryItem, ShoppingListItem, StockMovementLog, StockMovementType, StockSelection } from "@/types/inventory";
import type { PurchaseReceipt } from "@/types/receipt";

interface NewInventoryItem {
  name: string;
  currentStock: number;
  unit: string;
  lastCostPrice: number;
  minStockAlert: number;
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");

export function useInventoryStore(writerEnabled = true) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<StockMovementLog[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageIssue, setStorageIssue] = useState("");
  const inventoryRef = useRef<InventoryItem[]>([]);
  const logsRef = useRef<StockMovementLog[]>([]);
  const shoppingRef = useRef<ShoppingListItem[]>([]);
  const rawRef = useRef(new Map<string, string | null>());
  const readyRef = useRef(false);
  const validRef = useRef(true);

  useEffect(() => {
    const loadBundle = () => {
      const inventoryRaw = localStorage.getItem(INVENTORY_KEYS.inventory);
      const logsRaw = localStorage.getItem(INVENTORY_KEYS.logs);
      const shoppingRaw = localStorage.getItem(INVENTORY_KEYS.shoppingList);
      rawRef.current = new Map([
        [INVENTORY_KEYS.inventory, inventoryRaw],
        [INVENTORY_KEYS.logs, logsRaw],
        [INVENTORY_KEYS.shoppingList, shoppingRaw],
      ]);
      const presentCount = [inventoryRaw, logsRaw, shoppingRaw].filter(value => value !== null).length;
      const storedInventory = inventoryRaw !== null ? parseStoredInventory(inventoryRaw) : [];
      const storedLogs = logsRaw !== null ? parseStoredStockLogs(logsRaw) : [];
      const storedShopping = shoppingRaw !== null ? parseStoredShoppingList(shoppingRaw) : [];
      if ((presentCount !== 0 && presentCount !== 3) || !storedInventory || !storedLogs || !storedShopping
        || !hasValidInventoryReferences(storedInventory, storedLogs, storedShopping)) {
        validRef.current = false;
        return;
      }
      validRef.current = true;
      inventoryRef.current = storedInventory;
      logsRef.current = storedLogs;
      shoppingRef.current = storedShopping;
      setInventory(storedInventory);
      setLogs(storedLogs);
      setShoppingList(storedShopping);
    };
    const timer = window.setTimeout(() => {
      try { loadBundle(); } catch { validRef.current = false; }
      finally { readyRef.current = true; setHydrated(true); }
    }, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !Object.values(INVENTORY_KEYS).includes(event.key as typeof INVENTORY_KEYS[keyof typeof INVENTORY_KEYS])) return;
      try { loadBundle(); } catch { validRef.current = false; }
    };
    window.addEventListener("storage", onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, []);

  const commit = useCallback((nextInventory: InventoryItem[], nextLogs: StockMovementLog[], nextShopping: ShoppingListItem[], extraWrites = new Map<string, string>()) => {
    if (!writerEnabled || !readyRef.current || !validRef.current) return false;
    const writes = new Map(extraWrites);
    writes.set(INVENTORY_KEYS.inventory, JSON.stringify(nextInventory));
    writes.set(INVENTORY_KEYS.logs, JSON.stringify(nextLogs));
    writes.set(INVENTORY_KEYS.shoppingList, JSON.stringify(nextShopping));
    try {
      if (!commitStorageTransaction(localStorage, writes, rawRef.current)) return false;
    } catch (error) {
      if (!(error instanceof StorageInconsistentError)) throw error;
      validRef.current = false;
      setStorageIssue("Penyimpanan mungkin tidak konsisten. Muat ulang dan periksa data sebelum mencoba transaksi lagi.");
      return false;
    }
    rawRef.current = new Map([
      [INVENTORY_KEYS.inventory, writes.get(INVENTORY_KEYS.inventory)!],
      [INVENTORY_KEYS.logs, writes.get(INVENTORY_KEYS.logs)!],
      [INVENTORY_KEYS.shoppingList, writes.get(INVENTORY_KEYS.shoppingList)!],
    ]);
    inventoryRef.current = nextInventory;
    logsRef.current = nextLogs;
    shoppingRef.current = nextShopping;
    setInventory(nextInventory);
    setLogs(nextLogs);
    setShoppingList(nextShopping);
    return true;
  }, [writerEnabled]);

  const addItem = useCallback((input: NewInventoryItem) => {
    if (!input.name.trim() || !input.unit.trim() || !Number.isFinite(input.currentStock) || input.currentStock < 0 || input.currentStock > MAX_STOCK_QUANTITY
      || !Number.isSafeInteger(input.lastCostPrice) || input.lastCostPrice < 0
      || !Number.isFinite(input.minStockAlert) || input.minStockAlert < 0 || input.minStockAlert > MAX_STOCK_QUANTITY) return false;
    if (inventoryRef.current.some(item => normalizeName(item.name) === normalizeName(input.name))) return false;
    const timestamp = new Date().toISOString();
    return commit([{ ...input, id: newId(), name: input.name.trim(), unit: input.unit.trim(), updatedAt: timestamp }, ...inventoryRef.current], logsRef.current, shoppingRef.current);
  }, [commit]);

  const adjustStock = useCallback((itemId: string, changeQty: number, notes: string) => {
    if (!Number.isFinite(changeQty) || changeQty === 0 || Math.abs(changeQty) > MAX_STOCK_QUANTITY) return false;
    const item = inventoryRef.current.find(candidate => candidate.id === itemId);
    if (!item || item.currentStock + changeQty < 0 || item.currentStock + changeQty > MAX_STOCK_QUANTITY) return false;
    const timestamp = new Date().toISOString();
    const nextInventory = inventoryRef.current.map(candidate => candidate.id === itemId ? { ...candidate, currentStock: candidate.currentStock + changeQty, updatedAt: timestamp } : candidate);
    const log: StockMovementLog = { id: newId(), itemId, itemName: item.name, changeQty, type: "MANUAL_ADJUST", date: timestamp, notes };
    return commit(nextInventory, [log, ...logsRef.current], shoppingRef.current);
  }, [commit]);

  const editItem = useCallback((itemId: string, patch: Pick<InventoryItem, "name" | "currentStock" | "unit" | "lastCostPrice" | "minStockAlert">) => {
    const current = inventoryRef.current.find(item => item.id === itemId);
    if (!current || !patch.name.trim() || !patch.unit.trim() || !Number.isFinite(patch.currentStock) || patch.currentStock < 0 || patch.currentStock > MAX_STOCK_QUANTITY
      || !Number.isSafeInteger(patch.lastCostPrice) || patch.lastCostPrice < 0 || !Number.isFinite(patch.minStockAlert) || patch.minStockAlert < 0 || patch.minStockAlert > MAX_STOCK_QUANTITY) return false;
    if (inventoryRef.current.some(item => item.id !== itemId && normalizeName(item.name) === normalizeName(patch.name))) return false;
    const timestamp = new Date().toISOString();
    const changeQty = patch.currentStock - current.currentStock;
    const next = inventoryRef.current.map(item => item.id === itemId ? { ...item, ...patch, name: patch.name.trim(), unit: patch.unit.trim(), updatedAt: timestamp } : item);
    const nextLogs = changeQty === 0 ? logsRef.current : [{ id: newId(), itemId, itemName: patch.name.trim(), changeQty, type: "MANUAL_ADJUST" as const, date: timestamp, notes: "Edit stok fisik" }, ...logsRef.current];
    return commit(next, nextLogs, shoppingRef.current);
  }, [commit]);

  const syncPurchase = useCallback((receipt: PurchaseReceipt, extraWrites = new Map<string, string>()) => {
    try {
      const result = syncStockFromPurchase(receipt, inventoryRef.current, logsRef.current);
      return commit(result.updatedInventory, [...result.logs, ...logsRef.current], shoppingRef.current, extraWrites);
    } catch { return false; }
  }, [commit]);

  const deductSale = useCallback((selected: StockSelection[], type: Extract<StockMovementType, "OUT_DEBT" | "OUT_CASH_SALE">, notes: string, sourceId: string, extraWrites = new Map<string, string>()) => {
    try {
      const result = deductStockFromSale(selected, inventoryRef.current, type, notes, sourceId);
      return commit(result.updatedInventory, [...result.logs, ...logsRef.current], shoppingRef.current, extraWrites);
    } catch { return false; }
  }, [commit]);

  const addToShoppingList = useCallback((itemId: string) => {
    const item = inventoryRef.current.find(candidate => candidate.id === itemId);
    if (!item) return false;
    if (shoppingRef.current.some(entry => entry.inventoryItemId === itemId && !entry.checked)) return true;
    const entry: ShoppingListItem = { id: newId(), inventoryItemId: itemId, itemName: item.name, checked: false, createdAt: new Date().toISOString() };
    return commit(inventoryRef.current, logsRef.current, [entry, ...shoppingRef.current]);
  }, [commit]);

  const toggleShoppingItem = useCallback((id: string) => commit(inventoryRef.current, logsRef.current, shoppingRef.current.map(item => item.id === id ? { ...item, checked: !item.checked } : item)), [commit]);
  const removeShoppingItem = useCallback((id: string) => {
    if (!shoppingRef.current.some(item => item.id === id)) return false;
    return commit(inventoryRef.current, logsRef.current, shoppingRef.current.filter(item => item.id !== id));
  }, [commit]);
  const lowStock = useMemo(() => inventory.filter(item => item.currentStock <= item.minStockAlert), [inventory]);

  return { inventory, logs, shoppingList, lowStock, hydrated, storageIssue, addItem, adjustStock, editItem, syncPurchase, deductSale, addToShoppingList, toggleShoppingItem, removeShoppingItem };
}
