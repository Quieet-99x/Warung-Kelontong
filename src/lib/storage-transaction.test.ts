import { describe, expect, it } from "vitest";
import { commitStorageTransaction, StorageInconsistentError } from "./storage-transaction";

const createStorage = (initial: Record<string, string>) => {
  const values = new Map(Object.entries(initial));
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  };
};

describe("verified storage transaction", () => {
  it("writes and verifies every key before reporting success", () => {
    const { values, storage } = createStorage({ a: "old" });
    expect(commitStorageTransaction(storage, new Map([["a", "new"], ["b", "created"]]))).toBe(true);
    expect(Object.fromEntries(values)).toEqual({ a: "new", b: "created" });
  });

  it("rolls all keys back when a write is silently ignored", () => {
    const { values, storage } = createStorage({ a: "old-a", b: "old-b" });
    const guarded = { ...storage, setItem: (key: string, value: string) => { if (key !== "b" || value === "old-b") storage.setItem(key, value); } };
    expect(commitStorageTransaction(guarded, new Map([["a", "new-a"], ["b", "new-b"]]))).toBe(false);
    expect(Object.fromEntries(values)).toEqual({ a: "old-a", b: "old-b" });
  });

  it("rejects a stale snapshot before writing any key", () => {
    const { values, storage } = createStorage({ a: "changed-by-another-tab" });
    expect(commitStorageTransaction(storage, new Map([["a", "new"]]), new Map([["a", "old"]]))).toBe(false);
    expect(values.get("a")).toBe("changed-by-another-tab");
  });

  it("throws when rollback cannot be verified", () => {
    const { values, storage } = createStorage({ a: "old-a", b: "old-b" });
    const guarded = {
      ...storage,
      setItem: (key: string, value: string) => {
        if (key === "b" && value === "new-b") throw new Error("write failed");
        if (key === "a" && value === "old-a" && values.get("a") === "new-a") return;
        storage.setItem(key, value);
      },
    };
    expect(() => commitStorageTransaction(guarded, new Map([["a", "new-a"], ["b", "new-b"]])))
      .toThrow(StorageInconsistentError);
  });
});
