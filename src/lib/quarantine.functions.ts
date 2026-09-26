import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { claimEmail, isAdminEmail } from "@/lib/admin";
import {
  isAllowedQuarantineExt,
  mimeForQuarantine,
  quarantineRoot,
  resolveQuarantineFile,
} from "@/lib/quarantine-path";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MiB na súbor
const MAX_BATCH_BYTES = 24 * 1024 * 1024;
const MAX_BATCH_FILES = 12;

function assertAdmin(claims: unknown): void {
  const email = claimEmail(claims);
  if (!isAdminEmail(email)) {
    throw new Error("Táto sekcia je dostupná len administrátorovi.");
  }
}

export type QuarantineListItem = {
  name: string;
  bytes: number;
  mime: string;
};

export const getAdminQuarantineAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = claimEmail(context.claims);
    return {
      admin: isAdminEmail(email),
      email: email ?? "",
    };
  });

export const listQuarantineDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ files: QuarantineListItem[] }> => {
    assertAdmin(context.claims);
    const { readdir, stat } = await import("node:fs/promises");
    const root = quarantineRoot();
    let names: string[];
    try {
      names = await readdir(root);
    } catch {
      return { files: [] };
    }
    const files: QuarantineListItem[] = [];
    for (const name of names) {
      if (!isAllowedQuarantineExt(name)) continue;
      try {
        const full = resolveQuarantineFile(name);
        const st = await stat(full);
        if (!st.isFile()) continue;
        files.push({
          name,
          bytes: st.size,
          mime: mimeForQuarantine(name),
        });
      } catch {
        // skip invalid
      }
    }
    files.sort((a, b) => a.name.localeCompare(b.name, "sk"));
    return { files };
  });

const loadSchema = z.object({
  names: z.array(z.string().min(1).max(240)).min(1).max(MAX_BATCH_FILES),
});

export type QuarantineLoadedFile = {
  fileName: string;
  mime: string;
  /** Čistý base64 bez data: prefixu. */
  base64: string;
  bytes: number;
};

export const loadQuarantineDocuments = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loadSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ data, context }): Promise<{ files: QuarantineLoadedFile[] }> => {
      assertAdmin(context.claims);
      const { readFile, stat } = await import("node:fs/promises");
      const path = await import("node:path");
      const unique = [...new Set(data.names.map((n) => path.basename(n)))];
      if (unique.length > MAX_BATCH_FILES) {
        throw new Error(`Najviac ${MAX_BATCH_FILES} súborov naraz.`);
      }
      const out: QuarantineLoadedFile[] = [];
      let total = 0;
      for (const name of unique) {
        const full = resolveQuarantineFile(name);
        const st = await stat(full);
        if (!st.isFile()) throw new Error(`Súbor neexistuje: ${name}`);
        if (st.size > MAX_FILE_BYTES) {
          throw new Error(
            `${name} je väčší ako ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MiB.`,
          );
        }
        total += st.size;
        if (total > MAX_BATCH_BYTES) {
          throw new Error("Súčet vybraných súborov je príliš veľký.");
        }
        const buf = await readFile(full);
        out.push({
          fileName: name,
          mime: mimeForQuarantine(name),
          base64: buf.toString("base64"),
          bytes: st.size,
        });
      }
      return { files: out };
    },
  );
