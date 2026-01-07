import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  ExtensionManifest,
  GenerateProjectOptions,
  GenerateProjectResult,
  PageMeta,
} from './projectTypes.js';

const SCAFFOLD_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'scaffold'
);

function logMessage(options: GenerateProjectOptions, message: string): void {
  if (typeof options.onLog === 'function') options.onLog(message);
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function safeJoin(root: string, relPath: string): string {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    throw new Error('invalid file path');
  }
  if (path.isAbsolute(relPath)) throw new Error('absolute path is not allowed');
  const normalized = path.posix.normalize(relPath.replace(/\\/g, '/'));
  if (normalized.startsWith('..') || normalized.includes('/../')) {
    throw new Error('path traversal is not allowed');
  }
  return path.join(root, normalized);
}

function ensureOutputDir(outputDir: string, allowNonEmptyDir?: boolean): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    return;
  }
  const items = fs.readdirSync(outputDir);
  if (items.length > 0 && !allowNonEmptyDir) {
    throw new Error(`outputDir is not empty: ${outputDir}`);
  }
}

function renderTemplate(content: string, vars: Record<string, string>): string {
  let out = content;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`__${key}__`).join(value);
  }
  return out;
}

function ensureSafeFileName(name: string, label: string): void {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error(`${label} contains unsupported characters: ${name}`);
  }
}

function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function toIdentifier(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_]/g, '_');
  if (safe.length === 0) return 'lang';
  if (!/^[A-Za-z_]/.test(safe)) return `lang_${safe}`;
  return safe;
}

function toComponentIdentifier(name: string, fallback: string): string {
  const safe = name.replace(/[^A-Za-z0-9_]/g, '_');
  if (safe.length === 0) return fallback;
  if (!/^[A-Za-z_]/.test(safe)) return `${fallback}_${safe}`;
  return safe;
}

function validateManifest(manifest: ExtensionManifest): void {
  assertObject(manifest, 'manifest');
  if (manifest.version !== '1.0') {
    throw new Error('manifest.version must be "1.0"');
  }
  assertString(manifest.name, 'manifest.name');

  const routes = assertArray(manifest.routes, 'manifest.routes');
  for (const [i, r] of routes.entries()) {
    const route = assertObject(r, `routes[${i}]`);
    assertString(route.path, `routes[${i}].path`);
    assertString(route.pageId, `routes[${i}].pageId`);
  }

  const menus = assertArray(manifest.menus, 'manifest.menus');
  for (const [i, m] of menus.entries()) {
    const menu = assertObject(m, `menus[${i}]`);
    assertString(menu.parent, `menus[${i}].parent`);
    assertString(menu.name, `menus[${i}].name`);
    assertString(menu.title, `menus[${i}].title`);
    if (menu.icon != null && typeof menu.icon !== 'string') {
      throw new Error(`menus[${i}].icon must be a string`);
    }
    if (menu.order != null && typeof menu.order !== 'number') {
      throw new Error(`menus[${i}].order must be a number`);
    }
    if (menu.clusterModule != null && typeof menu.clusterModule !== 'string') {
      throw new Error(`menus[${i}].clusterModule must be a string`);
    }
  }

  const locales = assertArray(manifest.locales, 'manifest.locales');
  for (const [i, l] of locales.entries()) {
    const locale = assertObject(l, `locales[${i}]`);
    assertString(locale.lang, `locales[${i}].lang`);
    const messages = assertObject(locale.messages, `locales[${i}].messages`);
    for (const [k, v] of Object.entries(messages)) {
      if (typeof v !== 'string') {
        throw new Error(`locales[${i}].messages[${k}] must be a string`);
      }
    }
  }

  const pages = assertArray(manifest.pages, 'manifest.pages');
  for (const [i, p] of pages.entries()) {
    const page = assertObject(p, `pages[${i}]`);
    assertString(page.id, `pages[${i}].id`);
    assertString(page.entryComponent, `pages[${i}].entryComponent`);
  }

  if (manifest.build) {
    const build = assertObject(manifest.build, 'manifest.build');
    if (build.target !== 'kubesphere-extension') {
      throw new Error('manifest.build.target must be "kubesphere-extension"');
    }
    if (build.moduleName != null && typeof build.moduleName !== 'string') {
      throw new Error('manifest.build.moduleName must be a string');
    }
    if (build.systemjs != null && typeof build.systemjs !== 'boolean') {
      throw new Error('manifest.build.systemjs must be a boolean');
    }
  }

  const pageIds = new Set(pages.map((p) => (p as PageMeta).id));
  if (pageIds.size !== pages.length) {
    throw new Error('pages.id must be unique');
  }
  const localeLangs = new Set(locales.map((l) => (l as { lang: string }).lang));
  if (localeLangs.size !== locales.length) {
    throw new Error('locales.lang must be unique');
  }
  for (const [i, r] of routes.entries()) {
    const pageId = (r as PageMeta & { pageId: string }).pageId;
    if (!pageIds.has(pageId)) {
      throw new Error(`routes[${i}].pageId not found in pages: ${pageId}`);
    }
  }
}

function normalizeManifest(manifest: ExtensionManifest): ExtensionManifest {
  return {
    version: '1.0',
    name: String(manifest.name),
    displayName: manifest.displayName ?? undefined,
    description: manifest.description ?? undefined,
    routes: manifest.routes.map((r) => ({
      path: String(r.path),
      pageId: String(r.pageId),
    })),
    menus: manifest.menus.map((m) => ({
      parent: String(m.parent),
      name: String(m.name),
      title: String(m.title),
      icon: m.icon == null ? undefined : String(m.icon),
      order: m.order == null ? undefined : Number(m.order),
      clusterModule: m.clusterModule == null ? undefined : String(m.clusterModule),
    })),
    locales: manifest.locales.map((l) => ({
      lang: String(l.lang),
      messages: { ...l.messages },
    })),
    pages: manifest.pages.map((p) => ({
      id: String(p.id),
      entryComponent: String(p.entryComponent),
      componentsTree: p.componentsTree,
    })),
    build: manifest.build
      ? {
          target: 'kubesphere-extension',
          moduleName: manifest.build.moduleName
            ? String(manifest.build.moduleName)
            : undefined,
          systemjs: manifest.build.systemjs == null ? undefined : Boolean(manifest.build.systemjs),
        }
      : undefined,
  };
}

function renderPackageJson(
  outputDir: string,
  manifest: ExtensionManifest
): void {
  const templatePath = path.join(outputDir, 'package.json.tpl');
  const targetPath = path.join(outputDir, 'package.json');
  const raw = fs.readFileSync(templatePath, 'utf8');
  const rendered = renderTemplate(raw, {
    NAME: manifest.name,
    VERSION: manifest.version,
  });
  fs.writeFileSync(targetPath, rendered, 'utf8');
  fs.rmSync(templatePath, { force: true });
}

function renderExtensionConfig(
  outputDir: string,
  manifest: ExtensionManifest
): void {
  const templatePath = path.join(outputDir, 'src', 'extensionConfig.ts.tpl');
  const targetPath = path.join(outputDir, 'src', 'extensionConfig.ts');
  const raw = fs.readFileSync(templatePath, 'utf8');
  const rendered = renderTemplate(raw, {
    MENUS: JSON.stringify(manifest.menus, null, 2),
  });
  fs.writeFileSync(targetPath, rendered, 'utf8');
  fs.rmSync(templatePath, { force: true });
}

function renderRoutes(outputDir: string, manifest: ExtensionManifest): void {
  const tsxTemplate = path.join(outputDir, 'src', 'routes.tsx.tpl');
  const tsTemplate = path.join(outputDir, 'src', 'routes.ts.tpl');
  const useTsx = fs.existsSync(tsxTemplate);
  const templatePath = useTsx ? tsxTemplate : tsTemplate;
  const targetPath = path.join(outputDir, 'src', useTsx ? 'routes.tsx' : 'routes.ts');
  const raw = fs.readFileSync(templatePath, 'utf8');

  if (useTsx) {
    const used = new Set<string>();
    const nameByPageId = new Map<string, string>();
    for (const page of manifest.pages) {
      const base = toComponentIdentifier(page.id, 'Page');
      let name = base;
      let idx = 2;
      while (used.has(name)) {
        name = `${base}_${idx}`;
        idx += 1;
      }
      used.add(name);
      nameByPageId.set(page.id, name);
    }

    const importPageIds = Array.from(new Set(manifest.routes.map((r) => r.pageId)));
    const imports = importPageIds
      .map((pageId) => `import ${nameByPageId.get(pageId)} from './pages/${pageId}';`)
      .join('\n');

    const routes = manifest.routes
      .map((r) => {
        const component = nameByPageId.get(r.pageId) || 'Page';
        const pathLiteral = JSON.stringify(r.path);
        return `  {\n    path: ${pathLiteral},\n    element: <${component} />,\n  },`;
      })
      .join('\n');

    const rendered = renderTemplate(raw, {
      ROUTE_IMPORTS: imports,
      ROUTE_ENTRIES: routes,
    });
    fs.writeFileSync(targetPath, rendered, 'utf8');
    fs.rmSync(templatePath, { force: true });
    return;
  }

  const routes = manifest.routes.map((r) => ({
    path: r.path,
    component: `./pages/${r.pageId}`,
  }));
  const rendered = renderTemplate(raw, {
    ROUTES: JSON.stringify(routes, null, 2),
  });
  fs.writeFileSync(targetPath, rendered, 'utf8');
  fs.rmSync(templatePath, { force: true });
}

function renderLocales(outputDir: string, manifest: ExtensionManifest): void {
  const localesDir = path.join(outputDir, 'src', 'locales');
  fs.mkdirSync(localesDir, { recursive: true });

  const localeInfos = manifest.locales.map((locale) => {
    ensureSafeFileName(locale.lang, 'locale lang');
    const variableName = toIdentifier(locale.lang);
    return {
      lang: locale.lang,
      variableName,
      fileName: `${locale.lang}.json`,
    };
  });
  const varNames = new Set(localeInfos.map((l) => l.variableName));
  if (varNames.size !== localeInfos.length) {
    throw new Error('locales.lang results in duplicate identifiers');
  }

  for (const locale of manifest.locales) {
    const localePath = safeJoin(localesDir, `${locale.lang}.json`);
    const content = JSON.stringify(locale.messages, null, 2) + '\n';
    fs.writeFileSync(localePath, content, 'utf8');
  }

  const imports = localeInfos
    .map((l) => `import ${l.variableName} from './${l.fileName}';`)
    .join('\n');

  const exportsLines = localeInfos
    .map((l) => {
      if (isValidIdentifier(l.lang)) return `  ${l.variableName},`;
      return `  '${l.lang}': ${l.variableName},`;
    })
    .join('\n');

  const templatePath = path.join(localesDir, 'index.ts.tpl');
  const targetPath = path.join(localesDir, 'index.ts');
  const raw = fs.readFileSync(templatePath, 'utf8');
  const rendered = renderTemplate(raw, {
    LOCALE_IMPORTS: imports,
    LOCALE_EXPORTS: exportsLines,
  });
  fs.writeFileSync(targetPath, rendered, 'utf8');
  fs.rmSync(templatePath, { force: true });
}

function renderPages(
  outputDir: string,
  manifest: ExtensionManifest,
  options: GenerateProjectOptions
): void {
  const templateDir = path.join(outputDir, 'src', 'pages', '__PAGE__');
  const templatePath = path.join(templateDir, 'index.tsx.tpl');
  const templateRaw = fs.readFileSync(templatePath, 'utf8');

  for (const page of manifest.pages) {
    const pageDir = safeJoin(path.join(outputDir, 'src', 'pages'), page.id);
    fs.mkdirSync(pageDir, { recursive: true });
    const pageContent = String(options.componentGenerator(page, manifest) ?? '');

    const content = templateRaw.includes('__PAGE_CONTENT__')
      ? renderTemplate(templateRaw, { PAGE_CONTENT: pageContent })
      : pageContent;

    fs.writeFileSync(path.join(pageDir, 'index.tsx'), content, 'utf8');
  }

  fs.rmSync(templateDir, { recursive: true, force: true });
}

export function generateProject(
  manifest: ExtensionManifest,
  options: GenerateProjectOptions
): GenerateProjectResult {
  if (!options || typeof options !== 'object') {
    throw new Error('options is required');
  }
  if (typeof options.outputDir !== 'string' || options.outputDir.length === 0) {
    throw new Error('options.outputDir must be a non-empty string');
  }
  if (typeof options.componentGenerator !== 'function') {
    throw new Error('options.componentGenerator must be a function');
  }
  if (!fs.existsSync(SCAFFOLD_DIR)) {
    throw new Error(`scaffold directory not found: ${SCAFFOLD_DIR}`);
  }

  validateManifest(manifest);
  const normalized = normalizeManifest(manifest);

  ensureOutputDir(options.outputDir, options.allowNonEmptyDir);
  logMessage(options, 'copy scaffold');
  fs.cpSync(SCAFFOLD_DIR, options.outputDir, { recursive: true });

  logMessage(options, 'render templates');
  renderPackageJson(options.outputDir, normalized);
  renderExtensionConfig(options.outputDir, normalized);
  renderRoutes(options.outputDir, normalized);
  renderLocales(options.outputDir, normalized);
  renderPages(options.outputDir, normalized, options);

  const warnings: string[] = [];
  if (options.build) warnings.push('build is not implemented');
  if (options.archive) warnings.push('archive is not implemented');

  return { outputDir: options.outputDir, warnings };
}
