import { builtinModules } from "node:module";
import { defineConfig, type Plugin } from "vitest/config";

// React exportuje `act` len z development buildu. Kontajner má NODE_ENV=production,
// preto testy musia podmienku prepnúť skôr, než Vite vloží produkčný React.
if (process.env["NODE_ENV"] === "production") {
  process.env["NODE_ENV"] = "test";
}

const nodeBuiltinNames = new Set(
  builtinModules.filter((name) => !name.startsWith("node:")),
);

/**
 * Node 22 + Vite v JSDOM prostredí externalizuje `node:fs` ako
 * `__vite-browser-external`. Vitest z toho zloží neplatný builtin `node:`
 * (ERR_UNKNOWN_BUILTIN_MODULE). V klientskom testovacom prostredí preto
 * vrátime skutočný `node:*` modul skôr, než ho Vite zahodí.
 */
function jsdomNodeBuiltinAlias(): Plugin {
  const browserExternal = "__vite-browser-external";
  return {
    name: "forenx-jsdom-node-builtin-alias",
    enforce: "pre",
    resolveId(id) {
      if (this.environment?.name && this.environment.name !== "client") {
        return null;
      }
      let name = id;
      if (name.startsWith("node:")) name = name.slice("node:".length);
      if (name.startsWith(browserExternal)) {
        name = name.slice(browserExternal.length).replace(/^:/, "");
      }
      if (!name || !nodeBuiltinNames.has(name)) return null;
      return { id: `node:${name}`, external: true };
    },
  };
}

const runLiveE2e = process.env["RUN_LIVE_E2E"] === "1";
const liveTestFiles = [
  "src/lib/__tests__/live-e2e-laravel-import.test.ts",
  "src/lib/__tests__/real-postgres-registry-import.test.ts",
];

if (runLiveE2e && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Ignore if .env is missing in CI
  }
}

export default defineConfig({
  plugins: [jsdomNodeBuiltinAlias()],
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: runLiveE2e ? [] : ["src/test-setup.ts"],
    exclude: [
      "e2e/**",
      "src/lib/__tests__/bulk-media-sandbox.test.ts",
      "src/lib/__tests__/feature-parity.test.ts",
      "src/lib/__tests__/notifications-theme.test.ts",
      "src/lib/__tests__/e2e-forensic-flow.test.ts",
      "src/lib/__tests__/parse-uploaded-case.test.ts",
      "src/lib/__tests__/pwa-assets.test.ts",
      "src/lib/__tests__/vercel-security-headers.test.ts",
      ...(runLiveE2e ? [] : liveTestFiles),
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/routeTree.gen.ts",
        "src/routes/**",
        "src/components/**",
        "src/hooks/**",
        "src/integrations/**",
        "src/assets/**",
        "src/forensic/data/**",
      ],
      thresholds: {
        lines: 65,
        functions: 60,
        branches: 50,
        statements: 65,
      },
    },
  },
  resolve: {
    alias: {
      "@": `${import.meta.dirname}/src`,
    },
  },
});
