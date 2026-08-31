import { describe, expect, it, vi } from "vitest";
import { activateWaitingWorker } from "./pwa-update";

describe("PWA update activation", () => {
  it("waits for controllerchange before reloading", async () => {
    const postMessage = vi.fn();
    const update = vi.fn(async () => {});
    const registration = { update, waiting: { postMessage } } as unknown as ServiceWorkerRegistration;
    let controllerChanged: (() => void) | undefined;
    const serviceWorkers = {
      addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
        controllerChanged = listener as () => void;
      }),
    } as unknown as ServiceWorkerContainer;
    const reload = vi.fn();

    const activation = activateWaitingWorker(registration, serviceWorkers, reload);
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" }));
    expect(reload).not.toHaveBeenCalled();
    controllerChanged?.();
    await activation;
    expect(update).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("waits for an installing worker to become waiting", async () => {
    let stateChanged: (() => void) | undefined;
    const installing = {
      state: "installing",
      postMessage: vi.fn(),
      addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => { stateChanged = listener as () => void; }),
    } as unknown as ServiceWorker;
    const registration = { update: vi.fn(async () => {}), waiting: null, installing } as unknown as ServiceWorkerRegistration;
    let controllerChanged: (() => void) | undefined;
    const serviceWorkers = { addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => { controllerChanged = listener as () => void; }) } as unknown as ServiceWorkerContainer;
    const reload = vi.fn();

    const activation = activateWaitingWorker(registration, serviceWorkers, reload);
    await vi.waitFor(() => expect(installing.addEventListener).toHaveBeenCalledWith("statechange", expect.any(Function)));
    Object.defineProperty(installing, "state", { value: "installed" });
    stateChanged?.();
    await vi.waitFor(() => expect(installing.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" }));
    controllerChanged?.();
    await activation;
    expect(reload).toHaveBeenCalledOnce();
  });
});
