import { beforeEach, describe, expect, it, vi } from "vitest";

const { send, getSignedUrl } = vi.hoisted(() => ({
  send: vi.fn(),
  getSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class Command {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: class {
      send = send;
    },
    PutObjectCommand: class extends Command {},
    GetObjectCommand: class extends Command {},
    ListObjectsV2Command: class extends Command {},
    DeleteObjectsCommand: class extends Command {},
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

const REQUIRED_ENV = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

function configureS3() {
  vi.stubEnv("S3_ENDPOINT", "https://hel1.example.test");
  vi.stubEnv("S3_REGION", "hel1");
  vi.stubEnv("S3_BUCKET", "forenx-vault-sk");
  vi.stubEnv("S3_ACCESS_KEY_ID", "test-access-key");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret-key");
  vi.stubEnv("S3_FORCE_PATH_STYLE", "true");
}

function commandInput(call: number) {
  return (send.mock.calls[call]?.[0] as { input: unknown }).input;
}

describe("Hetzner S3 evidence storage", () => {
  beforeEach(() => {
    vi.resetModules();
    send.mockReset();
    getSignedUrl.mockReset();
    for (const name of REQUIRED_ENV) vi.stubEnv(name, "");
    vi.stubEnv("S3_FORCE_PATH_STYLE", "true");
  });

  it("is disabled when a required S3 variable is missing", async () => {
    configureS3();
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "");
    const { isS3StorageConfigured, uploadDocumentToS3 } =
      await import("@/lib/storage/s3.server");

    expect(isS3StorageConfigured()).toBe(false);
    await expect(
      uploadDocumentToS3(
        "case-1",
        "doc-1",
        "spis.pdf",
        Buffer.from("data"),
        "application/pdf",
        "a".repeat(64),
      ),
    ).rejects.toThrow("nie je nakonfigurované");
  });

  it("uploads evidence under a case-scoped key with SHA-256 metadata", async () => {
    configureS3();
    send.mockResolvedValue({});
    const { uploadDocumentToS3 } = await import("@/lib/storage/s3.server");
    const storagePath = await uploadDocumentToS3(
      "case-1",
      "doc-1",
      "../../Dôkaz 01.pdf",
      Buffer.from("evidence"),
      "application/pdf",
      "a".repeat(64),
    );

    expect(storagePath).toBe(
      "s3://forenx-vault-sk/cases/case-1/documents/doc-1-D_kaz_01.pdf",
    );
    expect(commandInput(0)).toMatchObject({
      Bucket: "forenx-vault-sk",
      Key: "cases/case-1/documents/doc-1-D_kaz_01.pdf",
      ContentType: "application/pdf",
      Metadata: { sha256: "a".repeat(64) },
    });
  });

  it("archives court PDFs under the case export prefix", async () => {
    configureS3();
    send.mockResolvedValue({});
    const { uploadCourtDossierToS3 } = await import("@/lib/storage/s3.server");
    const sha256 = "b".repeat(64);

    await expect(
      uploadCourtDossierToS3("case-1", sha256, new Uint8Array([1, 2, 3])),
    ).resolves.toBe(
      `s3://forenx-vault-sk/cases/case-1/exports/forensic-dossier-${sha256}.pdf`,
    );
    expect(commandInput(0)).toMatchObject({
      Key: `cases/case-1/exports/forensic-dossier-${sha256}.pdf`,
      ContentType: "application/pdf",
      Metadata: { sha256 },
    });
  });

  it("creates server-side download URLs for only its configured bucket", async () => {
    configureS3();
    getSignedUrl.mockResolvedValue("https://signed.example.test/file");
    const { getPresignedDownloadUrl } = await import("@/lib/storage/s3.server");

    await expect(
      getPresignedDownloadUrl(
        "s3://forenx-vault-sk/cases/case-1/documents/doc-1.pdf",
        7200,
      ),
    ).resolves.toBe("https://signed.example.test/file");
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Key: "cases/case-1/documents/doc-1.pdf",
        }),
      }),
      { expiresIn: 3600 },
    );
    await expect(
      getPresignedDownloadUrl("s3://foreign-bucket/private.pdf"),
    ).rejects.toThrow("Neplatný S3 kľúč");
  });

  it("deletes every paginated object under only the requested case prefix", async () => {
    configureS3();
    send
      .mockResolvedValueOnce({
        Contents: [{ Key: "cases/case-1/documents/a.pdf" }],
        IsTruncated: true,
        NextContinuationToken: "next-page",
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Contents: [{ Key: "cases/case-1/exports/report.pdf" }],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({});
    const { deleteCaseStorage } = await import("@/lib/storage/s3.server");

    await deleteCaseStorage("case-1");

    expect(commandInput(0)).toMatchObject({
      Bucket: "forenx-vault-sk",
      Prefix: "cases/case-1/",
    });
    expect(commandInput(1)).toMatchObject({
      Delete: { Objects: [{ Key: "cases/case-1/documents/a.pdf" }] },
    });
    expect(commandInput(2)).toMatchObject({
      Prefix: "cases/case-1/",
      ContinuationToken: "next-page",
    });
    expect(commandInput(3)).toMatchObject({
      Delete: { Objects: [{ Key: "cases/case-1/exports/report.pdf" }] },
    });
  });
});
