import test from "node:test";
import assert from "node:assert/strict";
import {
  createGenesisEntry,
  appendLedgerEntry,
  verifyLedgerIntegrity,
  GENESIS_PREV_HASH,
} from "./ledger";

test("vytvorí platný Genesis záznam so správnym prevHash", () => {
  const genesis = createGenesisEntry(
    "ČRZ-2025/084-A",
    "mjr. Ing. Peter Varga",
    "Miesto činu, sklad Pezinok",
    { popis: "Glock 19 Gen 5, v.č. CGDV051" },
    "2025-09-01T08:30:00Z",
  );

  assert.equal(genesis.index, 0);
  assert.equal(genesis.prevHash, GENESIS_PREV_HASH);
  assert.equal(genesis.action, "SEIZURE");
  assert.ok(genesis.hash);

  const result = verifyLedgerIntegrity([genesis]);
  assert.equal(result.valid, true);
  assert.equal(result.totalEntries, 1);
});

test("správne zreťazí viacero odovzdaní stopy a potvrdí integritu", () => {
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
  assert.equal(chain.length, 3);
  assert.equal(step1.prevHash, genesis.hash);
  assert.equal(step2.prevHash, step1.hash);

  const verification = verifyLedgerIntegrity(chain);
  assert.equal(verification.valid, true);
  assert.equal(verification.totalEntries, 3);
  assert.equal(verification.latestHash, step2.hash);
});

test("odhalí akúkoľvek manipuláciu s dátami (zlom v reťazci)", () => {
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

  const tamperedGenesis = { ...genesis, location: "Podvrhnuté miesto" };
  const tamperedChain = [tamperedGenesis, step1];

  const result = verifyLedgerIntegrity(tamperedChain);
  assert.equal(result.valid, false);
  assert.equal(result.brokenIndex, 0);
  assert.ok(result.reason?.includes("Kryptografická neplatnosť"));
});
