import { describe, expect, it } from "vitest";
import { parseStoredDebts, parseStoredStore } from "./storage";

const validDebt = {
  id: "d1",
  customerName: "Siti",
  phoneNumber: "0812",
  itemsDescription: "Beras",
  totalAmount: 100000,
  remainingAmount: 50000,
  status: "PARTIAL",
  createdAt: "2026-08-30T00:00:00.000Z",
  paymentHistory: [{ id: "p1", amountPaid: 50000, paidAt: "2026-08-30T01:00:00.000Z" }],
};

describe("stored data validation", () => {
  it("accepts structurally valid debts", () => {
    expect(parseStoredDebts(JSON.stringify([validDebt]))).toEqual([validDebt]);
  });

  it.each([
    "{}",
    JSON.stringify([{ ...validDebt, remainingAmount: "50000" }]),
    JSON.stringify([{ ...validDebt, remainingAmount: Number.POSITIVE_INFINITY }]),
    JSON.stringify([{ ...validDebt, status: "BROKEN" }]),
    JSON.stringify([{ ...validDebt, paymentHistory: null }]),
    JSON.stringify([{ ...validDebt, createdAt: "invalid" }]),
    JSON.stringify([{ ...validDebt, dueDate: "invalid" }]),
    JSON.stringify([{ ...validDebt, paymentHistory: [{ id: "p1", amountPaid: 50000, paidAt: "invalid" }] }]),
  ])("rejects invalid debt payload %s", payload => {
    expect(parseStoredDebts(payload)).toBeNull();
  });

  it("recovers valid debts when another record is corrupt", () => {
    expect(parseStoredDebts(JSON.stringify([validDebt, { ...validDebt, id: "broken", status: "BROKEN" }]))).toEqual([validDebt]);
  });

  it.each([
    { ...validDebt, totalAmount: 0, remainingAmount: 0, status: "PAID", paymentHistory: [] },
    { ...validDebt, paymentHistory: [{ ...validDebt.paymentHistory[0], amountPaid: 0 }] },
    { ...validDebt, status: "UNPAID" },
    { ...validDebt, status: "PARTIAL", paymentHistory: [] },
    { ...validDebt, paymentHistory: [{ ...validDebt.paymentHistory[0], amountPaid: 40000 }] },
  ])("rejects semantically inconsistent debt %#", debt => {
    expect(parseStoredDebts(JSON.stringify([debt]))).toBeNull();
  });

  it("accepts a valid store profile", () => {
    expect(parseStoredStore('{"storeName":"Warung A","ownerName":"Rina","paymentInfo":"QRIS"}')).toEqual({
      storeName: "Warung A",
      ownerName: "Rina",
      paymentInfo: "QRIS",
    });
  });

  it("accepts a validated QRIS image data URL", () => {
    const qrisImageBase64 = `data:image/png;base64,${btoa("\x89PNG\r\n\x1a\nmock")}`;
    expect(parseStoredStore(JSON.stringify({ storeName: "Warung A", ownerName: "Rina", qrisImageBase64 })))
      .toMatchObject({ qrisImageBase64 });
  });

  it.each([
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,not valid!",
    `data:image/png;base64,${btoa("not-a-real-image")}`,
    `data:image/png;base64,${"A".repeat(820_000)}`,
  ])("rejects an unsafe QRIS image %s", qrisImageBase64 => {
    expect(parseStoredStore(JSON.stringify({ storeName: "Warung A", ownerName: "Rina", qrisImageBase64 }))).toBeNull();
  });

  it.each(["[]", "{}", '{"storeName":"Warung A","ownerName":42}']) (
    "rejects invalid store payload %s",
    payload => expect(parseStoredStore(payload)).toBeNull(),
  );
});
