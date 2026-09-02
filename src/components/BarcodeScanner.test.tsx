import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarcodeScanner } from "./BarcodeScanner";

describe("BarcodeScanner", () => {
  afterEach(cleanup);
  it("accepts a manually entered barcode and emits scan feedback", async () => {
    const onDetected = vi.fn();
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    render(<BarcodeScanner open title="Scan barang" onClose={() => {}} onDetected={onDetected}/>);
    await userEvent.type(screen.getByLabelText("Nomor barcode"), "18998866200220");
    await userEvent.click(screen.getByRole("button", { name: "Gunakan barcode" }));
    expect(onDetected).toHaveBeenCalledWith("18998866200220");
    expect(vibrate).toHaveBeenCalledWith(80);
  });
});
