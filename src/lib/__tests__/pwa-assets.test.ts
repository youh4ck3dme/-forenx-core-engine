import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BRAND } from "@/config/brand";

const root = resolve(import.meta.dirname, "../../..");
const publicFile = (name: string) => resolve(root, "public", name);

describe("PWA assets", () => {
  it("ships RGBA branding at the declared dimensions", () => {
    for (const size of [256, 512, 1024]) {
      const png = readFileSync(publicFile(`branding/forenx-icon-${size}.png`));
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
      expect(png[25]).toBe(6);
    }
  });

  it("keeps a single generated manifest source in the PWA config", () => {
    expect(existsSync(publicFile("manifest.webmanifest"))).toBe(false);
    expect(existsSync(publicFile("manifest.json"))).toBe(false);

    const config = readFileSync(resolve(root, "vite.config.ts"), "utf8");
    expect(config).toContain("const pwaManifest = {");
    expect(config).toContain("manifest: pwaManifest");
    expect(config).toContain("forenx-dev-manifest");
    expect(config).toContain('start_url: "/prehlad"');
    expect(config).toContain("theme_color: BRAND.themeColor");
    expect(BRAND.themeColor).toBe("#07171c");

    for (const icon of [
      "android-chrome-192x192.png",
      "android-chrome-512x512.png",
      "apple-touch-icon.png",
      "favicon-32x32.png",
      "favicon-16x16.png",
      "logo.png",
      "icon-source.png",
    ]) {
      expect(readFileSync(publicFile(icon)).length).toBeGreaterThan(0);
    }
  });

  it("has exactly one service-worker source that purges old caches", () => {
    // Ručne písaný public/sw.js by build prepísal — worker má jediný zdroj.
    expect(() => readFileSync(publicFile("sw.js"), "utf8")).toThrow();

    const worker = readFileSync(resolve(root, "src", "sw.ts"), "utf8");
    expect(worker).toMatch(/forenx-sw-v\d+/);
    expect(worker).toContain("caches.delete(key)");
    expect(worker).toContain("precacheAndRoute");
    expect(worker).toContain('request.mode !== "navigate"');

    const config = readFileSync(resolve(root, "vite.config.ts"), "utf8");
    expect(config).toContain('strategies: "injectManifest"');
    expect(config).toContain('filename: "sw.ts"');

    const pwa = readFileSync(resolve(root, "src", "lib", "pwa.ts"), "utf8");
    expect(pwa).toContain("purgeStaleCaches");

    const fromPwa = pwa.match(/forenx-sw-v\d+/);
    const fromSw = worker.match(/forenx-sw-v\d+/);
    expect(fromPwa?.[0]).toBeTruthy();
    expect(fromSw?.[0]).toBe(fromPwa?.[0]);
  });
});
