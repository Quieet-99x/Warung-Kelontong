import { describe, expect, it } from "vitest";
import { searchItemNames } from "./item-search";

describe("searchItemNames", () => {
  const items = [
    { id: "1", name: "Minyakita Goreng 1 Liter" },
    { id: "2", name: "Indomie Goreng" },
    { id: "3", name: "Susu UHT Cokelat" },
  ];

  it("matches query tokens regardless of their order", () => {
    expect(searchItemNames(items, "goreng minyak").matches.map(item => item.id)).toEqual(["1"]);
  });

  it("returns a close suggestion for a typo", () => {
    const result = searchItemNames(items, "minykita");
    expect(result.matches).toEqual([]);
    expect(result.suggestions.map(item => item.id)).toEqual(["1"]);
  });
});