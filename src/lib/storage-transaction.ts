interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class StorageInconsistentError extends Error {
  constructor() {
    super("Penyimpanan mungkin tidak konsisten setelah transaksi gagal.");
    this.name = "StorageInconsistentError";
  }
}

export function commitStorageTransaction(
  storage: StorageLike,
  next: ReadonlyMap<string, string>,
  expected?: ReadonlyMap<string, string | null>,
): boolean {
  const previous = new Map<string, string | null>();
  try {
    for (const key of next.keys()) previous.set(key, storage.getItem(key));
    if (expected && [...expected].some(([key, value]) => previous.get(key) !== value)) return false;
    for (const [key, value] of next) storage.setItem(key, value);
    if (![...next].every(([key, value]) => storage.getItem(key) === value)) throw new Error("Storage verification failed");
    return true;
  } catch {
    for (const [key, value] of previous) {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {}
    }
    let rollbackVerified = false;
    try { rollbackVerified = [...previous].every(([key, value]) => storage.getItem(key) === value); }
    catch { rollbackVerified = false; }
    if (!rollbackVerified) throw new StorageInconsistentError();
    return false;
  }
}
