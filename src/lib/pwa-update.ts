/** A waiting worker never takes over or reloads this tab without an explicit action. */
export function watchPwaUpdate(
  registration: ServiceWorkerRegistration,
  container: ServiceWorkerContainer,
  notify: (available: boolean) => void,
  reload: () => void,
) {
  let requested = false;
  let reloaded = false;
  const workers = new Set<ServiceWorker>();
  const report = () =>
    notify(Boolean(registration.waiting && container.controller));
  const watchInstalling = () => {
    const worker = registration.installing;
    if (worker && !workers.has(worker)) {
      workers.add(worker);
      worker.addEventListener("statechange", report);
    }
    report();
  };
  const changed = () => {
    if (requested && !reloaded) {
      reloaded = true;
      reload();
    }
    report();
  };
  registration.addEventListener("updatefound", watchInstalling);
  container.addEventListener("controllerchange", changed);
  watchInstalling();
  return {
    activate() {
      if (requested) return;
      const waiting = registration.waiting;
      if (!waiting) {
        // Another tab may have activated it. Reload is still explicitly requested.
        reload();
        return;
      }
      requested = true;
      try {
        waiting.postMessage({ type: "SKIP_WAITING" });
      } catch (error) {
        requested = false;
        throw error;
      }
    },
    dispose() {
      registration.removeEventListener("updatefound", watchInstalling);
      container.removeEventListener("controllerchange", changed);
      workers.forEach((worker) =>
        worker.removeEventListener("statechange", report),
      );
    },
  };
}
