import { describe, it, expect } from "vitest";
import {
  createGenesisEntry,
  appendLedgerEntry,
  verifyLedgerIntegrity,
  GENESIS_PREV_HASH,
} from "../ledger";

describe("Chain of Custody Ledger (Tamper-evident SHA-256)", () => {
  it("vytvorí platný Genesis záznam so správnym prevHash", () => {
    const genesis = createGenesisEntry(
      "ČRZ-2025/084-A",
      "mjr. Ing. Peter Varga",
      "Miesto činu, sklad Pezinok",
      { popis: "Glock 19 Gen 5, v.č. CGDV051" },
      "2025-09-01T08:30:00Z",
    );

    expect(genesis.index).toBe(0);
    expect(genesis.prevHash).toBe(GENESIS_PREV_HASH);
    expect(genesis.action).toBe("SEIZURE");
    expect(genesis.hash).toBeDefined();

    const result = verifyLedgerIntegrity([genesis]);
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(1);
  });

  it("správne zreťazí viacero odovzdaní stopy a potvrdí integritu", () => {
    const genesis = createGenesisEntry(
      "ČRZ-2025/084-A",
      "mjr. Ing. Peter Varga",
      "Miesto činu, sklad Pezinok",
      { popis: "Glock 19 Gen 5, v.č. CGDV051" },
      "2025-09-01T08:30:00Z",
    );

    const step1 = appendLedgerEntry([genesis], {
      traceId: "ČRZ-2025/084-A",
      actor: "kpt. Mgr. Ján Kováč",
      action: "TRANSFER",
      location: "Kriminalistický a expertízny ústav PZ Bratislava",
      data: { odovzdal: "Varga", prevzal: "Kováč", pečať: "OK" },
      notes: "Odovzdané na balistickú expertízu",
      customTimestamp: "2025-09-01T12:00:00Z",
    });

    const step2 = appendLedgerEntry([genesis, step1], {
      traceId: "ČRZ-2025/084-A",
      actor: "doc. RNDr. Balistik, PhD.",
      action: "ANALYSIS",
      location: "Balistické laboratórium KEÚ PZ",
      data: { vysledok: "Zhoda s nábojnicou N-14", lr: "1:25000" },
      notes: "Mikroskopické porovnanie stôp úderníka",
      customTimestamp: "2025-09-02T10:15:00Z",
    });

    const chain = [genesis, step1, step2];
    expect(chain.length).toBe(3);
    expect(step1.prevHash).toBe(genesis.hash);
    expect(step2.prevHash).toBe(step1.hash);

    const verification = verifyLedgerIntegrity(chain);
    expect(verification.valid).toBe(true);
    expect(verification.totalEntries).toBe(3);
    expect(verification.latestHash).toBe(step2.hash);
  });

  it("odhalí akúkoľvek manipuláciu s dátami (zlom v reťazci)", () => {
    const genesis = createGenesisEntry(
      "ČRZ-2025/084-A",
      "mjr. Ing. Peter Varga",
      "Sklad",
      {
        note: "original",
      },
    );

    const step1 = appendLedgerEntry([genesis], {
      traceId: "ČRZ-2025/084-A",
      actor: "kpt. Kováč",
      action: "TRANSFER",
      location: "KEÚ",
      data: { status: "original" },
    });

    // Útočník sa pokúsi zmeniť lokalitu alebo dáta v genesis zázname
    const tamperedGenesis = { ...genesis, location: "Podvrhnuté miesto" };
    const tamperedChain = [tamperedGenesis, step1];

    const result = verifyLedgerIntegrity(tamperedChain);
    expect(result.valid).toBe(false);
    expect(result.brokenIndex).toBe(0);
    expect(result.reason).toContain("Kryptografická neplatnosť");
  });
});
