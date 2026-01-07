import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateProject } from './projectGenerator.js';
import type { ExtensionManifest, PageMeta } from './projectTypes.js';

function usage(): void {
  console.log('Usage: tsx src/projectCli.ts [--manifest path] [--out dir] [--force]');
}

function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function toComponentName(page: PageMeta, index: number): string {
  const raw = page.entryComponent || `Page${index + 1}`;
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, '_');
  const candidate = cleaned.length > 0 ? cleaned : `Page${index + 1}`;
  if (isValidIdentifier(candidate)) return candidate;
  return `Page${index + 1}`;
}

const args = process.argv.slice(2);
let manifestPath: string | null = null;
let outDir: string | null = null;
let force = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--manifest') {
    manifestPath = args[i + 1] ?? null;
    i += 1;
  } else if (arg === '--out') {
    outDir = args[i + 1] ?? null;
    i += 1;
  } else if (arg === '--force') {
    force = true;
  } else if (arg === '--') {
    continue;
  } else if (arg === '--help' || arg === '-h') {
    usage();
    process.exit(0);
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultManifest = path.resolve(here, '..', 'examples', 'manifest.sample.json');
const resolvedManifest = manifestPath
  ? path.resolve(process.cwd(), manifestPath)
  : defaultManifest;

const tmpRoot = path.resolve(process.cwd(), '.tmp');
if (!fs.existsSync(tmpRoot)) fs.mkdirSync(tmpRoot, { recursive: true });
const defaultOut = fs.mkdtempSync(path.join(tmpRoot, 'project-'));
const resolvedOut = outDir ? path.resolve(process.cwd(), outDir) : defaultOut;

let manifest: ExtensionManifest;
try {
  const raw = fs.readFileSync(resolvedManifest, 'utf8');
  manifest = JSON.parse(raw) as ExtensionManifest;
} catch (err) {
  console.error(`Failed to read manifest: ${resolvedManifest}`);
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

const result = generateProject(manifest, {
  outputDir: resolvedOut,
  allowNonEmptyDir: force,
  componentGenerator: (page, _manifest) => {
    const name = toComponentName(page, _manifest.pages.indexOf(page));
    const label = JSON.stringify(`Generated page: ${page.id}`);
    return `export default function ${name}() {\n  return <div>${label}</div>;\n}\n`;
  },
  onLog: (msg) => console.log(`[generator] ${msg}`),
  build: false,
  archive: false,
});

console.log(`Project generated at: ${result.outputDir}`);
if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings.join('; '));
}
