export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ScopedStorage extends BrowserStorage {
  readonly accountId: string;
  key(key: string): string;
}

const PREFIX = "buku-warung.account";

export function scopedStorageKey(userId: string, key: string): string {
  const account = userId.trim();
  if (!account) throw new Error("Identitas akun tidak valid.");
  return `${PREFIX}.${encodeURIComponent(account)}.${key}`;
}

export function createScopedStorage(storage: BrowserStorage, userId: string): ScopedStorage {
  const accountId = userId.trim();
  if (!accountId) throw new Error("Identitas akun tidak valid.");
  const key = (logicalKey: string) => scopedStorageKey(accountId, logicalKey);
  return {
    accountId,
    key,
    getItem: logicalKey => storage.getItem(key(logicalKey)),
    setItem: (logicalKey, value) => storage.setItem(key(logicalKey), value),
    removeItem: logicalKey => storage.removeItem(key(logicalKey)),
  };
}
