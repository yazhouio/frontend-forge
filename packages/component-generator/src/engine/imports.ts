import * as t from "@babel/types";

export interface ImportSpecIR {
  from: string;
  default?: string;
  namespace?: Set<string>;
  named?: Map<string, string | true>;
  sideEffect?: true;
  typeOnly?: boolean;
}

type ImportSpecMap = Record<string, ImportSpecIR>;

const getKey = (from: string, typeOnly: boolean) =>
  `${typeOnly ? "type" : "value"}:${from}`;

const isRelativeImport = (from: string) => from.startsWith(".");

const getItem = (
  imports: ImportSpecMap,
  from: string,
  typeOnly: boolean
) => {
  const key = getKey(from, typeOnly);
  const item = imports[key] ?? { from, typeOnly };
  imports[key] = item;
  return item;
};

const getImportedName = (specifier: t.ImportSpecifier) => {
  if (t.isIdentifier(specifier.imported)) {
    return specifier.imported.name;
  }
  if (t.isStringLiteral(specifier.imported)) {
    return specifier.imported.value;
  }
  return specifier.local.name;
};

const toImportSpecifier = (importedName: string, localName: string) => {
  const imported = t.isValidIdentifier(importedName)
    ? t.identifier(importedName)
    : t.stringLiteral(importedName);
  return t.importSpecifier(t.identifier(localName), imported);
};

export class ImportManager {
  static visitor(importDecls: t.ImportDeclaration[]): ImportSpecMap {
    const imports: ImportSpecMap = {};
    importDecls.forEach((node) => {
      if (!t.isImportDeclaration(node) || !node.source) {
        return;
      }
      const from = node.source.value;
      const declKind = node.importKind === "type" ? "type" : "value";

      if (!node.specifiers.length) {
        if (declKind === "value") {
          const item = getItem(imports, from, false);
          item.sideEffect = true;
        }
        return;
      }

      node.specifiers.forEach((specifier) => {
        const specKind =
          t.isImportSpecifier(specifier) && specifier.importKind
            ? specifier.importKind
            : declKind;
        const item = getItem(imports, from, specKind === "type");

        if (t.isImportNamespaceSpecifier(specifier)) {
          item.namespace = item.namespace ?? new Set();
          item.namespace.add(specifier.local.name);
          return;
        }

        if (t.isImportDefaultSpecifier(specifier)) {
          item.default = specifier.local.name;
          return;
        }

        if (t.isImportSpecifier(specifier)) {
          item.named = item.named ?? new Map();
          const importedName = getImportedName(specifier);
          const localName = specifier.local.name;
          item.named.set(
            importedName,
            importedName === localName ? true : localName
          );
        }
      });
    });

    return imports;
  }

  static toDeclarations(imports: ImportSpecMap): t.ImportDeclaration[] {
    const items = Object.values(imports).sort((x, y) => {
      const xRelative = isRelativeImport(x.from);
      const yRelative = isRelativeImport(y.from);
      if (xRelative !== yRelative) return xRelative ? 1 : -1;
      if (x.sideEffect !== y.sideEffect) return x.sideEffect ? -1 : 1;
      const index = x.from.localeCompare(y.from);
      if (index !== 0) return index;
      if (x.typeOnly !== y.typeOnly) return x.typeOnly ? 1 : -1;
      return 0;
    });

    const decls: t.ImportDeclaration[] = [];

    items.forEach((item) => {
      const source = t.stringLiteral(item.from);
      const hasSpecifiers =
        !!item.default ||
        (item.named && item.named.size > 0) ||
        (item.namespace && item.namespace.size > 0);

      if (item.sideEffect && !hasSpecifiers) {
        const decl = t.importDeclaration([], source);
        if (item.typeOnly) {
          decl.importKind = "type";
        }
        decls.push(decl);
        return;
      }

      const namespaces = item.namespace ? Array.from(item.namespace) : [];
      namespaces.forEach((name) => {
        const decl = t.importDeclaration(
          [t.importNamespaceSpecifier(t.identifier(name))],
          source
        );
        if (item.typeOnly) {
          decl.importKind = "type";
        }
        decls.push(decl);
      });

      const specifiers: t.ImportDeclaration["specifiers"] = [];
      if (item.default) {
        specifiers.push(
          t.importDefaultSpecifier(t.identifier(item.default))
        );
      }

      const namedEntries = item.named ? Array.from(item.named.entries()) : [];
      namedEntries.forEach(([importedName, localOrTrue]) => {
        const localName =
          localOrTrue === true ? importedName : localOrTrue;
        specifiers.push(toImportSpecifier(importedName, localName));
      });

      if (specifiers.length) {
        const decl = t.importDeclaration(specifiers, source);
        if (item.typeOnly) {
          decl.importKind = "type";
        }
        decls.push(decl);
      }
    });

    return decls;
  }

  static merge(importDecls: t.ImportDeclaration[]): t.ImportDeclaration[] {
    return ImportManager.toDeclarations(ImportManager.visitor(importDecls));
  }
}
