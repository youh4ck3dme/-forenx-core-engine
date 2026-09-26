import { describe, expect, it } from "vitest";
import { formatElapsed, processingProgress } from "../processing-progress";

describe("processing overlay progress", () => {
  it("formats elapsed time with stable digits", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(67)).toBe("01:07");
  });

  it("uses real queue position while reading files", () => {
    const first = processingProgress({
      stage: "reading",
      elapsedSeconds: 0,
      currentItem: 1,
      totalItems: 4,
    });
    const third = processingProgress({
      stage: "reading",
      elapsedSeconds: 0,
      currentItem: 3,
      totalItems: 4,
    });
    expect(third).toBeGreaterThan(first);
    expect(third).toBeLessThanOrEqual(72);
  });

  it("caps estimated AI progress below completion", () => {
    expect(
      processingProgress({ stage: "analysing", elapsedSeconds: 10_000 }),
    ).toBe(95);
    expect(
      processingProgress({ stage: "saving", elapsedSeconds: 10_000 }),
    ).toBe(98);
    expect(
      processingProgress({ stage: "complete", elapsedSeconds: 10_000 }),
    ).toBe(100);
  });
});
