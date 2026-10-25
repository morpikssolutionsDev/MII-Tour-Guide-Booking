import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Storage adapter (overview §9): local disk in development, Vercel Blob in production.
// Local files live outside public/ and are served by /uploads/[...path] with role checks.

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const PDF_TYPES: Record<string, string> = { "application/pdf": "pdf" };

export type StoredFile = { url: string; name: string; size: number };

export class UploadError extends Error {}

/** Validates type and size (server-side, overview §8.7) and stores the file under `folder`. */
export async function storeFile(
  file: File,
  folder: string,
  rules: { types: Record<string, string>; maxBytes: number; typeMessage: string; sizeMessage: string },
): Promise<StoredFile> {
  const ext = rules.types[file.type];
  if (!ext) throw new UploadError(rules.typeMessage);
  if (file.size > rules.maxBytes) throw new UploadError(rules.sizeMessage);
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  if (process.env.STORAGE_DRIVER === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, file, { access: "public", addRandomSuffix: true, contentType: file.type });
    return { url: blob.url, name: file.name, size: file.size };
  }

  const target = path.join(LOCAL_UPLOAD_DIR, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return { url: `/uploads/${key}`, name: file.name, size: file.size };
}

/** Reads a locally stored upload; rejects path traversal. */
export async function readLocalUpload(segments: string[]): Promise<{ data: Buffer; type: string } | null> {
  const target = path.resolve(LOCAL_UPLOAD_DIR, ...segments);
  if (!target.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return null;
  try {
    const data = await readFile(target);
    const ext = path.extname(target).slice(1);
    const type = Object.entries({ ...IMAGE_TYPES, ...PDF_TYPES }).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
    return { data, type };
  } catch {
    return null;
  }
}
