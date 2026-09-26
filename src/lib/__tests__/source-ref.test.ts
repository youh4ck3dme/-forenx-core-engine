import { describe, expect, it } from "vitest";
import { formatSourceRef, type SourceRef } from "../types";

describe("formatSourceRef", () => {
  it("handles null, undefined, or empty inputs", () => {
    expect(formatSourceRef(null)).toBe("");
    expect(formatSourceRef(undefined)).toBe("");
    expect(formatSourceRef("")).toBe("");
  });

  it("handles legacy string sources", () => {
    expect(formatSourceRef("  zápisnica č. 3, s. 12  ")).toBe(
      "zápisnica č. 3, s. 12",
    );
  });

  it("formats structured SourceRef with documentId and page", () => {
    const ref: SourceRef = {
      documentId: "DOC-2026-001",
      page: 15,
    };
    expect(formatSourceRef(ref)).toBe("DOC-2026-001 · s.15");
  });

  it("formats structured SourceRef with excerpt", () => {
    const ref: SourceRef = {
      documentId: "SPIS-ALFA",
      page: 3,
      excerpt: "platba bola schválená",
    };
    expect(formatSourceRef(ref)).toBe(
      "SPIS-ALFA · s.3 · „platba bola schválená“",
    );
  });

  it("falls back to label when excerpt is omitted", () => {
    const ref: SourceRef = {
      documentId: "ZMLUVA-09",
      label: "článok IV ods. 2",
    };
    expect(formatSourceRef(ref)).toBe("ZMLUVA-09 · článok IV ods. 2");
  });
});
