import { describe, expect, it } from "vitest";
import { addAmountToDebt, applyPayment } from "./debt";
import type { DebtItem } from "@/types";

const debt: DebtItem = { id:"1", customerName:"Siti", phoneNumber:"0812", itemsDescription:"Beras", totalAmount:100000, remainingAmount:100000, status:"UNPAID", createdAt:"2026-01-01", paymentHistory:[] };

describe("debt domain", () => {
  it("adds a purchase to an active debt", () => expect(addAmountToDebt(debt, 25000).remainingAmount).toBe(125000));
  it("records a partial payment", () => { const result=applyPayment(debt,40000,"p1","2026-01-02"); expect(result.status).toBe("PARTIAL"); expect(result.remainingAmount).toBe(60000); });
  it("caps payment at remaining balance and marks paid", () => { const result=applyPayment(debt,120000,"p2","2026-01-02"); expect(result.status).toBe("PAID"); expect(result.paymentHistory[0].amountPaid).toBe(100000); });
  it("rejects non-positive amounts", () => expect(() => applyPayment(debt,0,"p3","now")).toThrow());
  it.each([Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid payment amount %s", amount => {
    expect(() => applyPayment(debt, amount, "p4", "now")).toThrow();
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid added amount %s", amount => {
    expect(() => addAmountToDebt(debt, amount)).toThrow();
  });
});
