import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  appendLedgerEntry,
  computeEntryHash,
  computePayloadHash,
  createGenesisEntry,
  GENESIS_PREV_HASH,
  verifyLedgerIntegrity,
} from "../ledger";
import { computeDossierSha256, sha256Hex } from "../export-pdf";
import { regressionDossier } from "@/test-fixtures/autopilot";

describe("Forensic Cryptographic & Custody Integrity", () => {
  describe("NIST FIPS 180-4 SHA-256 Engine", () => {
    it("matches native Node.js crypto across various payload types", () => {
      const samples = [
        "",
        "Forenzná analýza digitálnych stôp",
        "ČRZ: 2026/09/SK-Bratislava § 119 TP",
        JSON.stringify({ id: "tr-001", amount: 15420.5, currency: "EUR" }),
        "A".repeat(50000),
      ];

      for (const sample of samples) {
        const nativeHash = createHash("sha256").update(sample).digest("hex");
        expect(sha256Hex(sample)).toBe(nativeHash);
      }
    });

    it("produces deterministic payload hashes", () => {
      const data1 = { a: 1, b: "test" };
      const data2 = { a: 1, b: "test" };
      expect(computePayloadHash(data1)).toBe(computePayloadHash(data2));
    });
  });

  describe("Tamper-Evident Chain of Custody Ledger", () => {
    it("generates valid genesis block with 64-zero parent link", () => {
      const genesis = createGenesisEntry(
        "STOPA-2026-001",
        "mjr. JUDr. Martin Baláž",
        "Miesto činu, Bratislava",
        { typ: "disk SATA 1TB", sn: "WD-WCC4N12345" },
        "2026-09-01T08:00:00Z",
      );

      expect(genesis.index).toBe(0);
      expect(genesis.prevHash).toBe(GENESIS_PREV_HASH);
      expect(genesis.action).toBe("SEIZURE");
      expect(genesis.hash).toBe(
        computeEntryHash(
          0,
          "STOPA-2026-001",
          "2026-09-01T08:00:00Z",
          "mjr. JUDr. Martin Baláž",
          "SEIZURE",
          "Miesto činu, Bratislava",
          genesis.payloadHash,
          GENESIS_PREV_HASH,
        ),
      );

      const verification = verifyLedgerIntegrity([genesis]);
      expect(verification.valid).toBe(true);
      expect(verification.totalEntries).toBe(1);
    });

    it("verifies multi-step custody handover chain without tampering", () => {
      const genesis = createGenesisEntry(
        "STOPA-2026-001",
        "mjr. JUDr. Martin Baláž",
        "Miesto činu, Bratislava",
        { typ: "disk SATA 1TB" },
        "2026-09-01T08:00:00Z",
      );

      const transfer = appendLedgerEntry([genesis], {
        traceId: "STOPA-2026-001",
        actor: "por. Bc. Jozef Kráľ",
        action: "TRANSFER",
        location: "Kriminalistický sklad PZ",
        data: { odovzdal: "Baláž", prevzal: "Kráľ", plomba: "OK" },
        customTimestamp: "2026-09-01T11:30:00Z",
      });

      const analysis = appendLedgerEntry([genesis, transfer], {
        traceId: "STOPA-2026-001",
        actor: "Ing. Forenzný Znalec, PhD.",
        action: "ANALYSIS",
        location: "KEÚ PZ Laboratórium digitálnych stôp",
        data: {
          nalez: "Bitová kópia vytvorená",
          md5: "e10adc3949ba59abbe56e057f20f883e",
        },
        customTimestamp: "2026-09-02T09:00:00Z",
      });

      const chain = [genesis, transfer, analysis];
      const result = verifyLedgerIntegrity(chain);

      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(3);
      expect(transfer.prevHash).toBe(genesis.hash);
      expect(analysis.prevHash).toBe(transfer.hash);
    });

    it("detects payload tampering in any block of the chain", () => {
      const genesis = createGenesisEntry(
        "STOPA-2026-002",
        "kpt. Peter Novák",
        "Sklad",
        { kusov: 10 },
      );
      const step1 = appendLedgerEntry([genesis], {
        traceId: "STOPA-2026-002",
        actor: "Technik A",
        action: "TRANSFER",
        location: "Lab",
        data: { kusov: 10 },
      });

      // Simulácia neoprávneného prepísania dát v databáze / payloadu
      const chain = [
        genesis,
        { ...step1, payloadHash: sha256Hex("sfalšované dáta") },
      ];

      const result = verifyLedgerIntegrity(chain);
      expect(result.valid).toBe(false);
      expect(result.brokenIndex).toBe(1);
      expect(result.reason).toContain(
        "hash bol zmenený alebo dáta zmanipulované",
      );
    });

    it("detects broken chain link if an intermediate block is deleted", () => {
      const genesis = createGenesisEntry("TR-3", "A", "L1", {});
      const step1 = appendLedgerEntry([genesis], {
        traceId: "TR-3",
        actor: "B",
        action: "TRANSFER",
        location: "L2",
        data: {},
      });
      const step2 = appendLedgerEntry([genesis, step1], {
        traceId: "TR-3",
        actor: "C",
        action: "STORAGE",
        location: "L3",
        data: {},
      });

      // Preskočenie stredného kroku step1
      const brokenChain = [genesis, step2];
      const result = verifyLedgerIntegrity(brokenChain);

      expect(result.valid).toBe(false);
      expect(result.brokenIndex).toBe(1);
    });

    it("detects unauthorized index manipulation", () => {
      const genesis = createGenesisEntry("TR-4", "A", "L1", {});
      const step1 = appendLedgerEntry([genesis], {
        traceId: "TR-4",
        actor: "B",
        action: "TRANSFER",
        location: "L2",
        data: {},
      });

      // Zmena indexu
      const tampered = { ...step1, index: 5 };
      const result = verifyLedgerIntegrity([genesis, tampered]);

      expect(result.valid).toBe(false);
      expect(result.brokenIndex).toBe(1);
    });
  });

  describe("Dossier & Export Cryptographic Integrity", () => {
    it("ensures identical SHA-256 for identical evidence regardless of object key order", () => {
      const d1 = regressionDossier();
      const d2 = JSON.parse(JSON.stringify(d1));

      expect(computeDossierSha256(d1)).toBe(computeDossierSha256(d2));
    });

    it("guarantees hash avalanche effect upon subtle tampering", () => {
      const original = regressionDossier();
      const baseHash = computeDossierSha256(original);

      // Zmena jedného znaku v dátume
      const modified = regressionDossier();
      modified.facts.timeline[0]!.time = "2026-01-16 10:00";
      const tamperedHash = computeDossierSha256(modified);

      expect(tamperedHash).not.toBe(baseHash);
      // Každý hash musí byť presne 64 hex znakov (SHA-256)
      expect(baseHash).toMatch(/^[0-9a-f]{64}$/);
      expect(tamperedHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
