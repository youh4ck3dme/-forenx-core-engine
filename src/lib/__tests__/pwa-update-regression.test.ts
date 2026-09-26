import { describe, expect, it, vi } from "vitest";
import { watchPwaUpdate } from "@/lib/pwa-update";

function fixture(firstInstall = false) {
  const worker = Object.assign(new EventTarget(), { postMessage: vi.fn() });
  const registration = Object.assign(new EventTarget(), {
    waiting: worker as typeof worker | null,
    installing: worker,
  });
  const container = Object.assign(new EventTarget(), {
    controller: firstInstall ? null : worker,
  });
  const notify = vi.fn();
  const reload = vi.fn();
  const watcher = watchPwaUpdate(
    registration as unknown as ServiceWorkerRegistration,
    container as unknown as ServiceWorkerContainer,
    notify,
    reload,
  );
  return { worker, registration, container, notify, reload, watcher };
}
describe("PWA explicit update", () => {
  it("reports waiting updates without activation or reload", () => {
    const f = fixture();
    expect(f.notify).toHaveBeenLastCalledWith(true);
    f.container.dispatchEvent(new Event("controllerchange"));
    expect(f.reload).not.toHaveBeenCalled();
    expect(f.worker.postMessage).not.toHaveBeenCalled();
    f.watcher.dispose();
  });
  it("activates only on click, reloads once after controller change", () => {
    const f = fixture();
    f.watcher.activate();
    f.watcher.activate();
    expect(f.worker.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: "SKIP_WAITING",
    });
    expect(f.reload).not.toHaveBeenCalled();
    f.container.dispatchEvent(new Event("controllerchange"));
    f.container.dispatchEvent(new Event("controllerchange"));
    expect(f.reload).toHaveBeenCalledTimes(1);
    f.watcher.dispose();
  });
  it("does not offer first installation as an update and removes listeners", () => {
    const f = fixture(true);
    expect(f.notify).toHaveBeenLastCalledWith(false);
    f.watcher.dispose();
    f.notify.mockClear();
    f.worker.dispatchEvent(new Event("statechange"));
    f.registration.dispatchEvent(new Event("updatefound"));
    expect(f.notify).not.toHaveBeenCalled();
  });
  it("detects an update installed after registration", () => {
    const f = fixture();
    f.registration.waiting = null;
    f.registration.dispatchEvent(new Event("updatefound"));
    expect(f.notify).toHaveBeenLastCalledWith(false);
    f.registration.waiting = f.worker;
    f.worker.dispatchEvent(new Event("statechange"));
    expect(f.notify).toHaveBeenLastCalledWith(true);
    f.watcher.dispose();
  });
});
