import path from "path";
import zlib from "zlib";
import type { VirtualFile } from "@frontend-forge/project-generator";

type TarErrorFactory = (message: string, statusCode?: number) => Error;

function normalizeTarPath(filePath: string, makeError: TarErrorFactory): string {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw makeError("invalid file path", 400);
  }
  const normalized = path.posix.normalize(filePath.replace(/\\/g, "/"));
  if (path.posix.isAbsolute(normalized)) {
    throw makeError("absolute path is not allowed", 400);
  }
  if (normalized.startsWith("..") || normalized.includes("/../")) {
    throw makeError("path traversal is not allowed", 400);
  }
  return normalized;
}

function splitTarPath(filePath: string, makeError: TarErrorFactory): { name: string; prefix: string } {
  if (filePath.length <= 100) return { name: filePath, prefix: "" };
  const idx = filePath.lastIndexOf("/");
  if (idx <= 0) {
    throw makeError(`file path is too long: ${filePath}`, 400);
  }
  const prefix = filePath.slice(0, idx);
  const name = filePath.slice(idx + 1);
  if (name.length === 0 || name.length > 100 || prefix.length > 155) {
    throw makeError(`file path is too long: ${filePath}`, 400);
  }
  return { name, prefix };
}

function toOctal(value: number, length: number): string {
  const out = Math.max(0, value).toString(8);
  return out.padStart(length - 1, "0") + "\0";
}

function tarHeader(filePath: string, size: number, mtimeMs: number, makeError: TarErrorFactory): Buffer {
  const header = Buffer.alloc(512, 0);
  const { name, prefix } = splitTarPath(filePath, makeError);

  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(toOctal(size, 12), 124, 12, "ascii");
  header.write(toOctal(Math.floor(mtimeMs / 1000), 12), 136, 12, "ascii");

  header.fill(0x20, 148, 156);
  header.write("0", 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  if (prefix) header.write(prefix, 345, 155, "utf8");

  let sum = 0;
  for (const byte of header) sum += byte;
  const checksum = sum.toString(8).padStart(6, "0");
  header.write(checksum, 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

function createTarBuffer(files: VirtualFile[], makeError: TarErrorFactory): Buffer {
  const stable = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const chunks: Buffer[] = [];
  const now = Date.now();

  for (const file of stable) {
    const safePath = normalizeTarPath(file.path, makeError);
    const content = Buffer.from(String(file.content ?? ""), "utf8");
    chunks.push(tarHeader(safePath, content.length, now, makeError));
    chunks.push(content);
    const pad = (512 - (content.length % 512)) % 512;
    if (pad) chunks.push(Buffer.alloc(pad, 0));
  }

  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

export function emitToTar(files: VirtualFile[], makeError: TarErrorFactory): Buffer {
  return createTarBuffer(files, makeError);
}

export function emitToTarGz(files: VirtualFile[], makeError: TarErrorFactory): Buffer {
  return zlib.gzipSync(createTarBuffer(files, makeError));
}
