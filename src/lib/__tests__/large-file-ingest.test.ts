import { describe, expect, it } from "vitest";
import { partitionBySize } from "@/lib/upload-prep";
import { IngestRequestSchema } from "@/lib/case-ingest.functions";
import {
  MAX_FILE_SIZE,
  chunkPdfPages,
  chunkProgressMessage,
  mergeIngestBatches,
  validateUploadSelection,
} from "@/lib/large-file-ingest";
import type { ForensicCaseUnified } from "@/types/forensic-case";

/** Presne ten spis, ktorý predtým spadol na strope 2,8 MB / 3,9 M znakov base64. */
const PREVIOUSLY_REJECTED_BYTES = Math.floor(2.8 * 1024 * 1024);
const PREVIOUSLY_REJECTED_BASE64_CHARS =
  4 * Math.ceil(PREVIOUSLY_REJECTED_BYTES / 3);

const baseCase = {
  metadata: {
    id: "case-large",
    userId: "u",
    name: "Veľký spis",
    subtitle: "",
    referenceDate: "2026-09-26",
    baseCurrency: "EUR",
    sha256Hash: "a".repeat(64),
    status: "draft" as const,
    tags: [],
    createdAt: "2026-09-26T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
    isDemo: false,
  },
  documents: [],
  entities: [],
  transactions: [],
  relationships: [],
  timeline: [],
} satisfies ForensicCaseUnified;

describe("veľký spis do 150 MB", () => {
  it("akceptuje súbor nad 5 MB", () => {
    const file = { name: "zvazok.pdf", size: 6 * 1024 * 1024 };
    expect(validateUploadSelection([file]).ok).toBe(true);
    expect(file.size).toBeLessThan(MAX_FILE_SIZE);
    const { accepted, rejected } = partitionBySize([file]);
    expect(rejected).toEqual([]);
    expect(accepted).toEqual([file]);
  });

  it("neodmietne 2,8 MB PDF, ktoré predtým žiadalo ručné rozdelenie", () => {
    const file = { name: "spis.pdf", size: PREVIOUSLY_REJECTED_BYTES };
    const selection = validateUploadSelection([file]);
    expect(selection.ok).toBe(true);
    const { accepted, rejected } = partitionBySize([file]);
    expect(rejected).toEqual([]);
    expect(accepted).toEqual([file]);

    const base64 = "A".repeat(PREVIOUSLY_REJECTED_BASE64_CHARS);
    expect(base64.length).toBeGreaterThan(3_900_000);
    expect(
      partitionBySize([
        { name: "spis.pdf", size: PREVIOUSLY_REJECTED_BYTES + 1 },
      ]).rejected,
    ).toEqual([]);
    const payload = {
      caseId: baseCase.metadata.id,
      consentVersion: "v1",
      files: [
        {
          name: "spis.pdf",
          base64,
          mimeType: "application/pdf",
        },
      ],
      existingCase: {
        ...baseCase,
        metadata: {
          ...baseCase.metadata,
          id: "11111111-1111-4111-8111-111111111111",
        },
      },
    };
    payload.caseId = payload.existingCase.metadata.id;
    expect(JSON.stringify(payload).length).toBeGreaterThan(3_900_000);
    expect(() => IngestRequestSchema.parse(payload)).not.toThrow();
    const parsed = IngestRequestSchema.parse(payload);
    expect(parsed.files[0]?.name).toBe("spis.pdf");
    expect(parsed.files[0]?.base64?.length).toBe(
      PREVIOUSLY_REJECTED_BASE64_CHARS,
    );
  });

  it("nad 150 MB súbor zastaví bez pokynu na ručné delenie", () => {
    const selection = validateUploadSelection([
      { name: "obri.pdf", size: MAX_FILE_SIZE + 1 },
    ]);
    expect(selection.ok).toBe(false);
    if (!selection.ok) {
      expect(selection.message).not.toMatch(/rozdeľte/i);
      expect(selection.message).toContain("150");
    }
  });

  it("rozdelí 50 strán do dávok a zlúči entity aj transakcie bez straty", () => {
    const pages = Array.from({ length: 50 }, (_, index) => ({
      page: index + 1,
      text: `Strana ${index + 1}`,
    }));
    const chunks = chunkPdfPages(pages);
    expect(chunks.map((chunk) => [chunk.startPage, chunk.endPage])).toEqual([
      [1, 12],
      [13, 24],
      [25, 36],
      [37, 48],
      [49, 50],
    ]);
    expect(chunks.map((chunk) => chunk.text).join("\n\n")).toBe(
      pages.map((page) => page.text).join("\n\n"),
    );
    expect(chunkProgressMessage(chunks[0]!)).toBe(
      "Spracovávam strany 1–12 z 50... Extrahujem subjekty...",
    );

    const merged = mergeIngestBatches(baseCase, [
      {
        entities: [
          {
            id: "e1",
            name: "Róbert Papcun",
            kind: "person",
            role: "konateľ",
            country: "SK",
            position: { x: 0, y: 0 },
          },
        ],
        transactions: [
          {
            id: "t1",
            date: "2022-06-16",
            amount: 5000,
            currency: "EUR",
            fromEntityId: "e1",
            toEntityId: "e2",
            method: "transfer",
            description: "vklad",
            anomalies: [],
          },
        ],
      },
      {
        entities: [
          {
            id: "e1-dup",
            name: "Róbert Papcun",
            kind: "person",
            role: "konateľ",
            country: "SK",
            position: { x: 1, y: 1 },
          },
          {
            id: "e2",
            name: "Papi Hair Design, s. r. o.",
            kind: "company",
            role: "spoločnosť",
            country: "SK",
            position: { x: 2, y: 2 },
          },
        ],
        transactions: [
          {
            id: "t2",
            date: "2022-07-01",
            amount: 1200,
            currency: "EUR",
            fromEntityId: "e2",
            toEntityId: "e1",
            method: "cash",
            description: "výber",
            anomalies: [],
          },
        ],
      },
    ]);

    expect(merged.entities.map((entity) => entity.name)).toEqual([
      "Róbert Papcun",
      "Papi Hair Design, s. r. o.",
    ]);
    expect(merged.transactions.map((tx) => tx.id)).toEqual(["t1", "t2"]);
  });
});
