import swc from "@swc/core";
import type { Module, ParseOptions } from "@swc/core";
import { ImportSpecIR } from "./interfaces";

const DEFAULT_SWC_PARSE_OPTIONS: ParseOptions = {
  syntax: "typescript",
  tsx: true,
  decorators: true,
  dynamicImport: true,
};

export class ImportManager {
  code: string;
  module: Module;
  imports: Record<string, ImportSpecIR> = {};

  constructor(
    code: string,
    parseOptions: ParseOptions = DEFAULT_SWC_PARSE_OPTIONS
  ) {
    this.code = code;
    this.module = swc.parseSync(code, parseOptions);
  }

  static visitor(module: Module) {
    const imports: Record<string, ImportSpecIR> = {};
    module.body.forEach((node) => {
      if (node.type === "ImportDeclaration") {
        const from = node.source.value;
        const item = imports[from] ?? { from };
        item.from = from;

        if (!node.typeOnly && !node.specifiers.length) {
          item.sideEffect = true;
          imports[from] = item;
          return;
        }

        if (node.typeOnly) {
          item.typeOnly = true;
        }

        node.specifiers.forEach((specifier) => {
          if (specifier.type === "ImportNamespaceSpecifier") {
            item.namespace = item.namespace ?? new Set();
            item.namespace.add(specifier.local.value);
            return;
          }

          if (specifier.type === "ImportDefaultSpecifier") {
            item.default = specifier.local.value;
            return;
          }

          if (specifier.type === "ImportSpecifier") {
            item.named = item.named ?? new Map();
            const importedName =
              specifier.imported?.value ?? specifier.local.value;
            const localName = specifier.local.value;
            item.named.set(
              importedName,
              importedName === localName ? true : localName
            );
          }
        });

        imports[from] = item;
      }
    });

    return imports;
  }

  visitor() {
    const imports = ImportManager.visitor(this.module);
    this.imports = imports;
    return this;
  }

  static toString(imports: Record<string, ImportSpecIR>) {
    const quoteModuleName = (from: string) =>
      `'${String(from).replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

    const item2string = (item: ImportSpecIR) => {
      const from = quoteModuleName(item.from);

      const { typeOnly, sideEffect } = item;
      if (!typeOnly && sideEffect) {
        return [`import ${from};`];
      }

      const typePrefix = typeOnly ? "type " : "";
      const lines = [];

      const namespaces = item.namespace ? Array.from(item.namespace) : [];
      namespaces.forEach((name) => {
        lines.push(`import ${typePrefix}* as ${name} from ${from};`);
      });

      const body = [];
      if (item.default) body.push(item.default);

      const namedEntries = item.named ? Array.from(item.named.entries()) : [];
      const named = namedEntries.map(([importedName, localOrTrue]) =>
        localOrTrue === true
          ? importedName
          : `${importedName} as ${localOrTrue}`
      );

      if (named.length) {
        body.push(`{ ${named.join(", ")} }`);
      }

      if (body.length) {
        lines.push(`import ${typePrefix}${body.join(", ")} from ${from};`);
      }

      return lines;
    };

    return Object.values(imports)
      .sort((x, y) => {
        if (x.from.startsWith("./")) return 1;
        if (y.from.startsWith("./")) return -1;
        if (x.sideEffect) return -1;
        if (y.sideEffect) return 1;
        const index = x.from.localeCompare(y.from);
        if (index !== 0) return index;
        if (x.typeOnly) return 1;
        if (y.typeOnly) return -1;
        return 0;
      })
      .flatMap((item) => item2string(item));
  }

  toString() {
    return ImportManager.toString(this.imports).join("\n");
  }
}
