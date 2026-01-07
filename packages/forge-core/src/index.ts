import fs from "fs";
import path from "path";
import {
  ALLOWED_FILE_RE,
  buildOnce,
  type BuildFile,
  type BuildResult,
  type TailwindOptions
} from "@frontend-forge/code-export";
import {
  generateProject,
  type ComponentGenerator,
  type ExtensionManifest
} from "@frontend-forge/project-generator";

export type ForgeBuildOptions = {
  entry?: string;
  externals?: string[];
  tailwind?: TailwindOptions;
  buildTimeoutMs?: number;
  childMaxOldSpaceMb?: number;
  vendorNodeModules?: string;
  rootNodeModules?: string;
};

export type ForgeProjectOptions = {
  manifest: ExtensionManifest;
  componentGenerator: ComponentGenerator;
  outputDir?: string;
  allowNonEmptyDir?: boolean;
  onLog?: (msg: string) => void;
  build?: ForgeBuildOptions | false;
};

export type ForgeResult = {
  projectDir: string;
  warnings: string[];
  build?: BuildResult | null;
};

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function collectFiles(root: string): BuildFile[] {
  const out: BuildFile[] = [];
  const queue: string[] = [root];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
        continue;
      }
      const rel = path.relative(root, full);
      if (!ALLOWED_FILE_RE.test(rel)) continue;
      out.push({ path: rel, content: fs.readFileSync(full, "utf8") });
    }
  }
  return out;
}

export async function forgeProject(options: ForgeProjectOptions): Promise<ForgeResult> {
  const { manifest, componentGenerator, allowNonEmptyDir, onLog } = options;
  const tmpRoot = path.join(process.cwd(), ".tmp");
  ensureDir(tmpRoot);
  const outputDir =
    options.outputDir ?? fs.mkdtempSync(path.join(tmpRoot, "forge-project-"));

  ensureDir(path.dirname(outputDir));

  const project = generateProject(manifest, {
    outputDir,
    allowNonEmptyDir,
    componentGenerator,
    onLog,
    build: false,
    archive: false
  });

  let build: BuildResult | null = null;
  if (options.build) {
    const externals = Array.isArray(options.build.externals) ? options.build.externals : [];
    const tailwind = options.build.tailwind ?? { enabled: false };
    const entry = options.build.entry ?? "src/index.tsx";
    const files = collectFiles(project.outputDir);
    build = await buildOnce({
      files,
      entry,
      externals,
      tailwind,
      buildTimeoutMs: options.build.buildTimeoutMs,
      childMaxOldSpaceMb: options.build.childMaxOldSpaceMb,
      vendorNodeModules: options.build.vendorNodeModules,
      rootNodeModules: options.build.rootNodeModules
    });
  }

  return { projectDir: project.outputDir, warnings: project.warnings, build };
}
