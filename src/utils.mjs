import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const ALLOWED_FILE_RE = /\.(ts|tsx|js|jsx|css|json)$/;

export function safeJoin(root, relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) throw new Error('invalid file path');
  if (path.isAbsolute(relPath)) throw new Error('absolute path is not allowed');
  const normalized = path.posix.normalize(relPath.replace(/\\/g, '/'));
  if (normalized.startsWith('..') || normalized.includes('/../')) throw new Error('path traversal is not allowed');
  return path.join(root, normalized);
}

export function sha256(obj) {
  return crypto.createHash('sha256').update(obj).digest('hex');
}

export function computeBuildKey({ files, entry, externals, tailwind }) {
  const stableFiles = [...files]
    .map(f => ({ path: String(f.path), content: String(f.content ?? '') }))
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

export function mkWorkDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ks-plugin-build-'));
}

export function rmWorkDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function nowMs() {
  const [s, ns] = process.hrtime();
  return s * 1000 + ns / 1e6;
}

export function binPath(binName) {
  return path.resolve(process.cwd(), 'node_modules', '.bin', binName);
}
