import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import type { BuildFile, BuildKeyInput } from "./types.js";

export const ALLOWED_FILE_RE = /\.(ts|tsx|js|jsx|css|json)$/;

export function safeJoin(root: string, relPath: string): string {
  if (typeof relPath !== "string" || relPath.length === 0) throw new Error("invalid file path");
  if (path.isAbsolute(relPath)) throw new Error("absolute path is not allowed");
  const normalized = path.posix.normalize(relPath.replace(/\\/g, "/"));
  if (normalized.startsWith("..") || normalized.includes("/../")) throw new Error("path traversal is not allowed");
  return path.join(root, normalized);
}

export function sha256(obj: string): string {
  return crypto.createHash("sha256").update(obj).digest("hex");
}

export function computeBuildKey({ files, entry, externals, tailwind }: BuildKeyInput): string {
  const stableFiles = [...files]
    .map((f: BuildFile) => ({ path: String(f.path), content: String(f.content ?? "") }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const payload = {
    v: 1,
    entry,
    externals,
    tailwind,
    files: stableFiles
  };

  return sha256(JSON.stringify(payload));
}

export function mkWorkDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ks-plugin-build-"));
}

export function rmWorkDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function nowMs(): number {
  const [s, ns] = process.hrtime();
  return s * 1000 + ns / 1e6;
}

export function binPath(binName: string): string {
  return path.resolve(process.cwd(), "node_modules", ".bin", binName);
}

export function findFirstExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}
