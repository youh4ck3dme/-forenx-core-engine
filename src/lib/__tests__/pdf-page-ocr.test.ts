/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractPdfViaPageOcr,
  joinOcrPageTexts,
  prepareScannedPdfPages,
} from "@/lib/pdf-page-ocr";

const { getDocument, getPage } = vi.hoisted(() => {
  const getPage = vi.fn();
  const getDocument = vi.fn();
  return { getDocument, getPage };
});

vi.mock("pdfjs-dist", () => ({
  version: "4.10.38",
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: (args: unknown) => getDocument(args),
}));

function mockPdf(numPages: number) {
  getPage.mockImplementation(async (pageNum: number) => ({
    getViewport: ({ scale }: { scale: number }) => ({
      width: 100 * scale,
      height: 140 * scale,
    }),
    render: () => ({ promise: Promise.resolve() }),
  }));
  getDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages,
      getPage: (n: number) => getPage(n),
    }),
  });
}

describe("prepareScannedPdfPages", () => {
  beforeEach(() => {
    getDocument.mockReset();
    getPage.mockReset();
    // jsdom canvas → toBlob môže chýbať
    HTMLCanvasElement.prototype.toBlob = function (
      cb: BlobCallback,
      _type?: string,
      _quality?: number,
    ) {
      cb(new Blob([new Uint8Array(1200)], { type: "image/jpeg" }));
    };
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      // render path only needs a truthy 2d context
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it("pripraví PDF nad pôvodným limitom pre automatické dávkovanie", async () => {
    mockPdf(31);
    const file = new File([new Uint8Array(8)], "sken.pdf", {
      type: "application/pdf",
    });
    await expect(prepareScannedPdfPages(file)).resolves.toHaveLength(31);
  });

  it("vráti JPEG payloady pre každú stránku", async () => {
    mockPdf(2);
    const file = new File([new Uint8Array(8)], "sken.pdf", {
      type: "application/pdf",
    });
    const pages = await prepareScannedPdfPages(file);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.fileName).toBe("sken.p1.jpg");
    expect(pages[1]!.fileName).toBe("sken.p2.jpg");
    expect(pages[0]!.fileBase64.length).toBeGreaterThan(0);
    expect(pages[0]!.page).toBe(1);
  });
});

describe("extractPdfViaPageOcr", () => {
  beforeEach(() => {
    getDocument.mockReset();
    getPage.mockReset();
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob([new Uint8Array(800)], { type: "image/jpeg" }));
    };
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockReturnValue(
        {},
      ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it("spojí OCR texty stránok cez extractFn", async () => {
    mockPdf(13);
    const file = new File([new Uint8Array(8)], "sken.pdf", {
      type: "application/pdf",
    });
    const extractFn = vi.fn(async (payloads: Array<{ fileName: string }>) => ({
      results: [
        ...payloads.map((payload) => ({
          fileName: payload.fileName,
          success: true,
          text: `Text z ${payload.fileName} s dostatočným obsahom pre prah.`,
          usedOcr: true,
        })),
      ],
    }));

    const res = await extractPdfViaPageOcr(file, "v1", extractFn);
    expect(res.success).toBe(true);
    expect(res.usedOcr).toBe(true);
    expect(extractFn).toHaveBeenCalledTimes(2);
    expect(extractFn.mock.calls[0]?.[0]).toHaveLength(12);
    expect(extractFn.mock.calls[1]?.[0]).toHaveLength(1);
    expect(res.text).toContain("--- strana 1 ---");
    expect(res.text).toContain("--- strana 13 ---");
  });

  it("joinOcrPageTexts zachová poradie", () => {
    const out = joinOcrPageTexts([
      { page: 3, text: "c" },
      { page: 1, text: "a" },
    ]);
    expect(out.indexOf("strana 1")).toBeLessThan(out.indexOf("strana 3"));
  });
});
