import { describe, expect, it } from "vitest";
import { formatIDR, isValidWhatsAppNumber, sanitizePhoneNumber, parseIDRInput } from "./utils";

describe("utils", () => {
  it("formats rupiah without decimals", () => expect(formatIDR(450000)).toBe("Rp 450.000"));
  it.each([["0812-3456 7890", "6281234567890"], ["+62 812 3456", "628123456"], ["62812", "62812"]])("sanitizes %s", (input, expected) => expect(sanitizePhoneNumber(input)).toBe(expected));
  it("parses formatted currency input", () => expect(parseIDRInput("Rp 125.000")).toBe(125000));
  it("parses native number input exponent notation", () => expect(parseIDRInput("1e3")).toBe(1000));
  it.each(["081234567890", "+62 812-3456-7890", "6281234567890"])("accepts WhatsApp number %s", value => {
    expect(isValidWhatsAppNumber(value)).toBe(true);
  });
  it.each(["abc", "0812", "", "123456789", "abc081234567890xyz", "08----------12", "628123456789012"])("rejects invalid WhatsApp number %s", value => {
    expect(isValidWhatsAppNumber(value)).toBe(false);
  });
});
