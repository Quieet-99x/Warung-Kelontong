function waitForWaitingWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorker | null> {
  if (registration.waiting) return Promise.resolve(registration.waiting);
  const installing = registration.installing;
  if (!installing) return Promise.resolve(null);
  return new Promise(resolve => {
    const onStateChange = () => {
      if (installing.state === "installed") resolve(registration.waiting ?? installing);
      else if (installing.state === "redundant") resolve(null);
    };
    installing.addEventListener("statechange", onStateChange);
  });
}

export async function activateWaitingWorker(
  registration: ServiceWorkerRegistration,
  serviceWorkers: ServiceWorkerContainer,
  reload: () => void,
): Promise<boolean> {
  await registration.update();
  const waiting = await waitForWaitingWorker(registration);
  if (!waiting) return false;
  const changed = new Promise<void>(resolve => {
    serviceWorkers.addEventListener("controllerchange", () => resolve(), { once: true });
  });
  waiting.postMessage({ type: "SKIP_WAITING" });
  await changed;
  reload();
  return true;
}
