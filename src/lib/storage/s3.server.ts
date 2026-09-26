import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type S3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function config(): S3Config | undefined {
  const endpoint = process.env["S3_ENDPOINT"]?.trim();
  const region = process.env["S3_REGION"]?.trim();
  const bucket = process.env["S3_BUCKET"]?.trim();
  const accessKeyId = process.env["S3_ACCESS_KEY_ID"]?.trim();
  const secretAccessKey = process.env["S3_SECRET_ACCESS_KEY"]?.trim();
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey)
    return undefined;
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

export function isS3StorageConfigured(): boolean {
  return config() !== undefined;
}

function client(settings: S3Config): S3Client {
  return new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    forcePathStyle: process.env["S3_FORCE_PATH_STYLE"] !== "false",
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });
}

function requireConfig(): S3Config {
  const settings = config();
  if (!settings)
    throw new Error("Hetzner S3 nie je nakonfigurované na serveri.");
  return settings;
}

function safeFilename(filename: string): string {
  return (
    filename
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/\.\.+/g, "")
      .replace(/^_+|_+$/g, "")
      .slice(0, 180) || "document"
  );
}

export async function uploadDocumentToS3(
  caseId: string,
  docId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string,
  sha256: string,
): Promise<string> {
  const settings = requireConfig();
  const key = `cases/${caseId}/documents/${docId}-${safeFilename(filename)}`;
  await client(settings).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: { sha256 },
    }),
  );
  return `s3://${settings.bucket}/${key}`;
}

export async function uploadCourtDossierToS3(
  caseId: string,
  sha256: string,
  bytes: Uint8Array,
): Promise<string> {
  const settings = requireConfig();
  const key = `cases/${caseId}/exports/forensic-dossier-${sha256}.pdf`;
  await client(settings).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: bytes,
      ContentType: "application/pdf",
      Metadata: { sha256 },
    }),
  );
  return `s3://${settings.bucket}/${key}`;
}

function keyFromStoragePath(storageKey: string, bucket: string): string {
  const prefix = `s3://${bucket}/`;
  if (!storageKey.startsWith(prefix)) throw new Error("Neplatný S3 kľúč.");
  return storageKey.slice(prefix.length);
}

export async function getPresignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const settings = requireConfig();
  const key = keyFromStoragePath(storageKey, settings.bucket);
  return getSignedUrl(
    client(settings),
    new GetObjectCommand({ Bucket: settings.bucket, Key: key }),
    { expiresIn: Math.min(Math.max(expiresInSeconds, 60), 3600) },
  );
}

export async function deleteCaseStorage(caseId: string): Promise<void> {
  const settings = requireConfig();
  const s3 = client(settings);
  const prefix = `cases/${caseId}/`;
  let continuationToken: string | undefined;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: settings.bucket,
        Prefix: prefix,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      }),
    );
    const objects = (listed.Contents ?? [])
      .map((item) => item.Key)
      .filter((Key): Key is string => Boolean(Key))
      .map((Key) => ({ Key }));
    if (objects.length)
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: settings.bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (continuationToken);
}
