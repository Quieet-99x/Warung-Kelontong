import { describe, expect, it } from "vitest";
import { createScopedStorage, scopedStorageKey } from "./scoped-storage";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("account-scoped browser storage", () => {
  it("keeps the same logical key isolated between Google accounts", () => {
    const storage = new MemoryStorage();
    const accountA = createScopedStorage(storage, "google-user-a");
    const accountB = createScopedStorage(storage, "google-user-b");

    accountA.setItem("warung_inventory", "stok-a");
    accountB.setItem("warung_inventory", "stok-b");

    expect(accountA.getItem("warung_inventory")).toBe("stok-a");
    expect(accountB.getItem("warung_inventory")).toBe("stok-b");
    expect(storage.getItem("buku-warung.account.google-user-a.warung_inventory")).toBe("stok-a");
  });

  it("does not expose an unscoped testing key to a signed-in account", () => {
    const storage = new MemoryStorage();
    storage.setItem("buku-kasbon.debts.v1", "data-testing-lama");

    const account = createScopedStorage(storage, "google-user-a");

    expect(account.getItem("buku-kasbon.debts.v1")).toBeNull();
  });

  it("uses an opaque encoded namespace for provider identifiers", () => {
    expect(scopedStorageKey("google:user/123", "daily_closings"))
      .toBe("buku-warung.account.google%3Auser%2F123.daily_closings");
  });

  it("exposes the physical key used to scope storage events and writer locks", () => {
    const storage = createScopedStorage(new MemoryStorage(), "google-user-a");
    expect(storage.key("stock_logs")).toBe("buku-warung.account.google-user-a.stock_logs");
    expect(storage.accountId).toBe("google-user-a");
  });
});
