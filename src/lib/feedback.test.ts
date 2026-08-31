import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackManager } from "./feedback";

describe("FeedbackManager", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses vibration when supported", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
    new FeedbackManager().triggerHaptic([40, 60, 80]);
    expect(vibrate).toHaveBeenCalledWith([40, 60, 80]);
  });

  it("does not throw when audio is unsupported", () => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
    expect(() => new FeedbackManager().playBeep()).not.toThrow();
    expect(() => new FeedbackManager().playKaching()).not.toThrow();
  });
});
