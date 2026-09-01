import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync("src/app/globals.css", "utf8");
const headers = readFileSync("src/app/page-header-system.css", "utf8");

describe("shared green page header system", () => {
  it("defines one responsive spacing and typography scale", () => {
    expect(globals).toContain("--page-header-gutter:22px");
    expect(globals).toContain("--page-header-top:max(34px,calc(24px + env(safe-area-inset-top)))");
    expect(globals).toContain("--page-header-title:22px");
    expect(globals).toContain("--page-header-body:12px");
  });

  it("applies the same top rhythm and type scale to every green page header", () => {
    expect(headers).toContain(".hero,.kulakan-hero,.inventory-hero,.cashflow-hero");
    expect(headers).toContain("padding-top:var(--page-header-top)");
    expect(headers).toContain("padding-inline:var(--page-header-gutter)");
    expect(headers).toContain(".brand-row h1,.kulakan-hero h1,.inventory-hero h1,.cashflow-hero[data-theme=green]>h1");
    expect(headers).toContain("font-size:var(--page-header-title)");
    expect(headers).toContain(".brand-row p,.inventory-hero p");
    expect(headers).toContain("font-size:var(--page-header-body)");
  });

  it("keeps long configurable store names inside the Kasbon header", () => {
    expect(headers).toContain(".brand-row>div:nth-child(2)");
    expect(headers).toContain("min-width:0");
    expect(headers).toContain("overflow-wrap:anywhere");
    expect(headers).toContain("-webkit-line-clamp:2");
  });

  it("keeps the same comfortable desktop distance from the screen edge", () => {
    expect(headers).toContain("@media(min-width:640px)");
    expect(headers).toContain(".kulakan-page,.inventory-page,.cashflow-page");
    expect(headers).toContain("margin:24px auto");
  });

  it("keeps a comfortable but consistent mobile gutter", () => {
    expect(headers).toContain("@media(max-width:390px)");
    expect(headers).toContain("--page-header-gutter:18px");
  });
});
