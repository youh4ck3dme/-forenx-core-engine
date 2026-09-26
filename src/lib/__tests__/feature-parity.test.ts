import { describe, expect, it } from "vitest";
import {
  collectPolicies,
  renderChecklist,
  routeFileCandidates,
  runParityCheck,
  type FileSystemLike,
} from "@/lib/feature-parity/check";
import { createRepoFs } from "@/lib/feature-parity/node-fs";
import { FEATURE_REGISTRY } from "@/lib/feature-parity/registry";
import { navGroups, navItems } from "@/components/malte/nav";

const repo = createRepoFs();
const report = runParityCheck(repo);

function formatFindings(kind?: string) {
  return report.findings
    .filter((finding) => !kind || finding.kind === kind)
    .map(
      (finding) =>
        `• [${finding.featureId}] ${finding.kind}: ${finding.detail}`,
    )
    .join("\n");
}

describe("Parita funkcií — register", () => {
  it("každá funkcia má jedinečný identifikátor", () => {
    const ids = FEATURE_REGISTRY.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("register pokrýva všetky fázy toku od prípadov po export", () => {
    const stages = new Set(FEATURE_REGISTRY.map((feature) => feature.stage));
    for (const stage of [
      "pripady",
      "nahravanie",
      "workspace",
      "zistenia",
      "export",
    ]) {
      expect(stages.has(stage as never)).toBe(true);
    }
  });
});

describe("Parita funkcií — workflowy", () => {
  it("žiadny workflow ani súbor nechýba", () => {
    const missing = report.findings.filter(
      (finding) =>
        finding.kind === "chýbajúci workflow" ||
        finding.kind === "chýbajúci súbor",
    );
    expect(missing, `Chýbajúce workflowy:\n${formatFindings()}`).toEqual([]);
  });

  it("každá obrazovka z navigácie má vlastný súbor route", () => {
    const routes = [...navItems, ...navGroups.flatMap((group) => group.items)];
    const missing = routes.filter(
      (item) =>
        !routeFileCandidates(item.to, true).some((path) => repo.exists(path)),
    );
    expect(missing.map((item) => item.to)).toEqual([]);
  });

  it("každá chránená obrazovka z registra je dostupná z navigácie alebo z iného toku", () => {
    const navRoutes = new Set(
      [...navItems, ...navGroups.flatMap((group) => group.items)].map(
        (item) => item.to,
      ),
    );
    // Obrazovky mimo menu (otvárajú sa z tokov) sú vymenované explicitne.
    const reachableWithoutMenu = new Set([
      "/asistent",
      "/start",
      "/vitajte",
      "/viac",
    ]);
    const unreachable = FEATURE_REGISTRY.filter(
      (feature) =>
        feature.requiresAuth &&
        feature.route &&
        !navRoutes.has(feature.route) &&
        !reachableWithoutMenu.has(feature.route),
    );
    expect(unreachable.map((feature) => feature.route)).toEqual([]);
  });
});

describe("Parita funkcií — validácie", () => {
  it("žiadna povinná validácia vstupu nechýba", () => {
    const missing = report.findings.filter(
      (finding) => finding.kind === "chýbajúca validácia",
    );
    expect(
      missing,
      `Chýbajúce validácie:\n${formatFindings("chýbajúca validácia")}`,
    ).toEqual([]);
  });
});

describe("Parita funkcií — oprávnenia", () => {
  it("žiadne oprávnenie (RLS) nechýba", () => {
    const missing = report.findings.filter(
      (finding) => finding.kind === "chýbajúce oprávnenie",
    );
    expect(
      missing,
      `Chýbajúce oprávnenia:\n${formatFindings("chýbajúce oprávnenie")}`,
    ).toEqual([]);
  });

  it("parser politík rešpektuje poradie vytvorenia a zrušenia", () => {
    const policies = collectPolicies([
      {
        path: "a.sql",
        sql: `create policy "own" on public.demo for all to authenticated using (true);`,
      },
      {
        path: "b.sql",
        sql: `drop policy "own" on public.demo;
create policy "demo_select_own" on public.demo for select to authenticated using (true);`,
      },
    ]);
    expect([...(policies.get("demo") ?? [])]).toEqual(["select"]);
  });

  it("odhalí tabuľku bez politiky pre mazanie", () => {
    const fs: FileSystemLike = {
      exists: () => true,
      read: () => "",
      listMigrations: () => [
        {
          path: "a.sql",
          sql: `create policy "cases_select_own" on public.cases for select to authenticated using (true);`,
        },
      ],
    };
    const partial = runParityCheck(fs, [
      {
        id: "demo",
        label: "Demo",
        stage: "pripady",
        requiresAuth: true,
        files: [],
        tables: ["cases"],
      },
    ]);
    expect(partial.findings.map((finding) => finding.detail)).toContain(
      "tabuľka cases nemá vlastnícku politiku pre DELETE",
    );
  });
});

describe("Parita funkcií — kontrolný zoznam", () => {
  it("vygeneruje markdown so všetkými funkciami", () => {
    const markdown = renderChecklist(report);
    expect(markdown).toContain("# Kontrolný zoznam parity funkcií ForenX");
    for (const feature of FEATURE_REGISTRY) {
      expect(markdown).toContain(feature.label);
    }
  });

  it("všetky funkcie registra prechádzajú kontrolou", () => {
    expect(report.passed, `Nálezy:\n${formatFindings()}`).toBe(report.total);
  });
});
