import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FileSystemLike } from "./check";

/** Prístup k reálnemu repozitáru pre testy a reportovací skript. */
export function createRepoFs(root = process.cwd()): FileSystemLike {
  const cache = new Map<string, string>();
  return {
    exists: (path) => existsSync(resolve(root, path)),
    read: (path) => {
      const full = resolve(root, path);
      const cached = cache.get(full);
      if (cached !== undefined) return cached;
      const content = readFileSync(full, "utf8");
      cache.set(full, content);
      return content;
    },
    listMigrations: () => {
      const dir = resolve(root, "supabase/migrations");
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((name) => name.endsWith(".sql"))
        .sort()
        .map((name) => ({
          path: `supabase/migrations/${name}`,
          sql: readFileSync(join(dir, name), "utf8"),
        }));
    },
  };
}
