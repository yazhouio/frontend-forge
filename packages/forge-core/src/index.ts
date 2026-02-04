import fs from "fs";
import path from "path";
import type { ComponentGeneratorLike } from "@frontend-forge/component-generator";
import type { CodeExporterLike } from "@frontend-forge/code-export";
import type {
  ExtensionManifest,
  PageMeta,
  PageRenderer,
  ProjectGeneratorLike,
  VirtualFile
} from "@frontend-forge/project-generator";
import { emitToTar as emitToTarInternal, emitToTarGz as emitToTarGzInternal } from "./tar.js";

export type ForgeCoreOptions = {
  componentGenerator: ComponentGeneratorLike;
  projectGenerator: ProjectGeneratorLike;
  codeExporter?: CodeExporterLike | null;
};

export type ForgeProjectFilesOptions = {
  onLog?: (message: string) => void;
  pageRenderer?: PageRenderer;
};

export type ForgeBuildProjectOptions = ForgeProjectFilesOptions & {
  build?: boolean;
};

export class ForgeError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = "ForgeError";
    this.statusCode = statusCode;
  }
}

export function isForgeError(err: unknown): err is ForgeError {
  return err instanceof ForgeError;
}

function defaultPageRenderer(generator: ComponentGeneratorLike): PageRenderer {
  return (page: PageMeta) => {
    if (page.componentsTree == null) return "";
    return String(generator.generatePageCode(page.componentsTree));
  };
}

function safeJoin(root: string, relPath: string): string {
  if (typeof relPath !== "string" || relPath.length === 0) {
    throw new ForgeError("invalid file path", 400);
  }
  if (path.isAbsolute(relPath)) throw new ForgeError("absolute path is not allowed", 400);
  const normalized = path.posix.normalize(relPath.replace(/\\/g, "/"));
  if (normalized.startsWith("..") || normalized.includes("/../")) {
    throw new ForgeError("path traversal is not allowed", 400);
  }
  return path.join(root, normalized);
}

function emitFilesToDir(outputDir: string, files: VirtualFile[]): void {
  const stable = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of stable) {
    const full = safeJoin(outputDir, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.content, "utf8");
  }
}

export class ForgeCore {
  private componentGenerator: ComponentGeneratorLike;
  private projectGenerator: ProjectGeneratorLike;
  private codeExporter: CodeExporterLike | null;

  constructor(options: ForgeCoreOptions) {
    if (!options?.componentGenerator) {
      throw new ForgeError("componentGenerator is required", 400);
    }
    if (!options?.projectGenerator) {
      throw new ForgeError("projectGenerator is required", 400);
    }

    this.componentGenerator = options.componentGenerator;
    this.projectGenerator = options.projectGenerator;
    this.codeExporter = options.codeExporter ?? null;
  }

  getCodeExporter(): CodeExporterLike | null {
    return this.codeExporter;
  }

  generatePageCode(schema: unknown): string {
    return this.componentGenerator.generatePageCode(schema);
  }

  async generateProjectFiles(
    manifest: ExtensionManifest,
    options: ForgeProjectFilesOptions = {}
  ): Promise<VirtualFile[]> {
    const pageRenderer = options.pageRenderer ?? defaultPageRenderer(this.componentGenerator);
    const result = await this.projectGenerator.generateProjectFiles(manifest, {
      pageRenderer,
      onLog: options.onLog,
      build: false,
      archive: false
    });

    if (result.warnings.length && options.onLog) {
      result.warnings.forEach((warning) => options.onLog?.(`[warning] ${warning}`));
    }

    return result.files;
  }

  async buildVirtualFiles(files: VirtualFile[]): Promise<VirtualFile[]> {
    if (!this.codeExporter) {
      throw new ForgeError("codeExporter is required to build virtual files", 400);
    }
    const result = await this.codeExporter.buildVirtualFiles(files);
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.files)) return result.files;
    throw new ForgeError("codeExporter.buildVirtualFiles must return files", 500);
  }

  async buildProject(
    manifest: ExtensionManifest,
    options: ForgeBuildProjectOptions = {}
  ): Promise<VirtualFile[]> {
    const files = await this.generateProjectFiles(manifest, options);
    if (options.build) {
      return this.buildVirtualFiles(files);
    }
    return files;
  }

  emitToFileSystem(files: VirtualFile[], dir: string): void {
    if (typeof dir !== "string" || dir.length === 0) {
      throw new ForgeError("output dir must be a non-empty string", 400);
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    emitFilesToDir(dir, files);
  }

  emitToTar(files: VirtualFile[]): Buffer {
    return emitToTarInternal(files, (message, statusCode) => new ForgeError(message, statusCode));
  }

  emitToTarGz(files: VirtualFile[]): Buffer {
    return emitToTarGzInternal(files, (message, statusCode) => new ForgeError(message, statusCode));
  }
}

export type {
  ComponentGeneratorLike,
  CodeExporterLike,
  ExtensionManifest,
  PageMeta,
  PageRenderer,
  ProjectGeneratorLike,
  VirtualFile
};

export type { MaybePromise } from "@frontend-forge/code-export";
