import { promises as fs } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    dir: "apps/server/src/preview",
    out: ".tmp/preview-files.json",
    skip: new Set(["demo.ts", "demo.js"]),
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--dir") {
      args.dir = argv[++i] ?? args.dir;
      continue;
    }
    if (token === "--out") {
      args.out = argv[++i] ?? args.out;
      continue;
    }
    if (token === "--skip") {
      const value = argv[++i];
      if (value) args.skip.add(value);
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
  }

  return args;
}

async function listFilesRecursive(rootDir) {
  const results = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        results.push(absolutePath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      [
        "Usage: node scripts/export-engine-files.mjs [--dir <dir>] [--out <file>] [--skip <filename>]",
        "",
        "Defaults:",
        `  --dir ${args.dir}`,
        `  --out ${args.out}`,
        "  --skip demo.ts (and demo.js)",
        "",
      ].join("\n")
    );
    return;
  }

  const repoRoot = process.cwd();
  const engineDir = path.resolve(repoRoot, args.dir);
  const outFile = path.resolve(repoRoot, args.out);
  const outDir = path.dirname(outFile);

  const absoluteFiles = await listFilesRecursive(engineDir);
  const files = [];

  for (const absolutePath of absoluteFiles) {
    const fileName = path
      .relative(engineDir, absolutePath)
      .replaceAll(path.sep, "/");
    const baseName = path.basename(fileName);
    if (args.skip.has(baseName)) continue;
    const content = await fs.readFile(absolutePath, "utf8");
    files.push({ fileName, content });
  }

  files.sort((a, b) => a.fileName.localeCompare(b.fileName));

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(files, null, 2) + "\n", "utf8");

  process.stdout.write(
    `Wrote ${files.length} files to ${path.relative(repoRoot, outFile)}\n`
  );
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err) + "\n");
  process.exit(1);
});
