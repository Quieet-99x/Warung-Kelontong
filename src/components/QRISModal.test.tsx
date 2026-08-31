import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QRISModal from "./QRISModal";

const { playBeep } = vi.hoisted(() => ({ playBeep: vi.fn() }));
vi.mock("@/lib/feedback", () => ({ feedback: { playBeep } }));

const image = "data:image/png;base64,iVBORw0KGgptb2Nr";

describe("QRISModal", () => {
  beforeEach(cleanup);

  it("shows the static QRIS image and exact payment guidance", () => {
    render(<QRISModal open onClose={() => {}} store={{ storeName: "Warung Berkah", ownerName: "Ani", qrisImageBase64: image }} amount={65_000}/>);
    expect(screen.getByRole("img", { name: /QRIS Warung Berkah/i })).toHaveAttribute("src", image);
    expect(screen.getByText("Rp65.000")).toBeInTheDocument();
    expect(screen.getByText(/masukkan nominal tersebut/i)).toBeInTheDocument();
    expect(playBeep).toHaveBeenCalled();
  });

  it("shows a settings fallback, closes with Escape, and restores trigger focus", async () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const { rerender } = render(<QRISModal open onClose={onClose} store={{ storeName: "Warung", ownerName: "Ani" }} amount={20_000}/>);
    expect(screen.getByText(/Foto QRIS belum diunggah/i)).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    rerender(<QRISModal open={false} onClose={onClose} store={{ storeName: "Warung", ownerName: "Ani" }} amount={20_000}/>);
    await vi.waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });
});
