import { CodeFragment, Stat } from "./interfaces.js";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { ImportManager } from "./imports.js";
import { HookCollector, PreparedFragment } from "./hookCollector.js";
import { StatementScope } from "../constants.js";

export class CodeGenerator {
  private hookCollector = new HookCollector();

  generate(fragments: Map<string, CodeFragment>): string {
    const renderFragments = Array.from(fragments.values()).filter(
      (fragment) => fragment.meta.renderBoundary
    );
    const allImports = renderFragments.flatMap((fragment) =>
      this.collectImports(fragment, fragments)
    );
    const moduleImports: t.ImportDeclaration[] = [];
    const moduleDecls: t.Statement[] = [];
    const moduleInits: t.Statement[] = [];
    const functions: t.FunctionDeclaration[] = [];

    const prepared = new Map<string, PreparedFragment>();
    renderFragments.forEach((fragment) => {
      const preparedFragment = this.hookCollector.prepare(
        fragment,
        fragments,
        prepared
      );
      const scoped = this.collectScopedStats(preparedFragment.stats);
      moduleImports.push(...scoped.moduleImports);
      moduleDecls.push(...this.flattenStats(scoped.moduleDecls));
      moduleInits.push(...this.flattenStats(scoped.moduleInits));

      const orderedStats = this.hookCollector.sortStats(scoped.functionBody);
      const functionStats = [
        ...scoped.functionDecls,
        ...orderedStats,
        ...scoped.block,
        ...scoped.controlFlow,
        ...scoped.jsx,
      ];
      functions.push(
        this.buildFunctionDeclaration(preparedFragment.fragment, functionStats)
      );
    });

    const mergedImports = ImportManager.merge([
      ...allImports,
      ...moduleImports,
    ]);
    const defaultExport = this.resolveDefaultExport(fragments);
    const statements = [
      ...mergedImports,
      ...moduleDecls,
      ...moduleInits,
      ...functions,
    ];
    if (defaultExport) {
      statements.push(
        t.exportDefaultDeclaration(t.identifier(defaultExport))
      );
    }
    const ast = t.file(t.program(statements));
    return generate(ast).code;
  }

  private resolveDefaultExport(fragments: Map<string, CodeFragment>): string | null {
    const marked = Array.from(fragments.values()).find(
      (fragment) => fragment.meta.exportDefault && fragment.meta.title
    );
    return marked?.meta.title ?? null;
  }

  private buildFunctionDeclaration(
    fragment: CodeFragment,
    stats: Stat[]
  ): t.FunctionDeclaration {
    return t.functionDeclaration(
      t.identifier(fragment.meta.title!),
      [t.identifier("props")],
      t.blockStatement([
        ...stats.flatMap((stat) =>
          Array.isArray(stat.stat) ? stat.stat : [stat.stat]
        ),
        t.returnStatement(fragment.jsx),
      ])
    );
  }

  private collectScopedStats(stats: Stat[]) {
    const scoped = {
      moduleImports: [] as t.ImportDeclaration[],
      moduleDecls: [] as Stat[],
      moduleInits: [] as Stat[],
      functionDecls: [] as Stat[],
      functionBody: [] as Stat[],
      block: [] as Stat[],
      controlFlow: [] as Stat[],
      jsx: [] as Stat[],
    };

    stats.forEach((stat) => {
      switch (stat.scope) {
        case StatementScope.ModuleImport: {
          const { imports, rest } = this.extractImportDeclarations(stat);
          scoped.moduleImports.push(...imports);
          if (rest.length) {
            scoped.moduleDecls.push(this.withStatements(stat, rest));
          }
          break;
        }
        case StatementScope.ModuleDecl:
          scoped.moduleDecls.push(stat);
          break;
        case StatementScope.ModuleInit:
          scoped.moduleInits.push(stat);
          break;
        case StatementScope.FunctionDecl:
          scoped.moduleDecls.push(stat);
          break;
        case StatementScope.FunctionBody:
          scoped.functionBody.push(stat);
          break;
        case StatementScope.Block:
          scoped.block.push(stat);
          break;
        case StatementScope.ControlFlow:
          scoped.controlFlow.push(stat);
          break;
        case StatementScope.JSX:
          scoped.jsx.push(stat);
          break;
        default:
          scoped.functionBody.push(stat);
          break;
      }
    });

    return scoped;
  }

  private flattenStats(stats: Stat[]): t.Statement[] {
    const statements: t.Statement[] = [];
    stats.forEach((stat) => {
      if (Array.isArray(stat.stat)) {
        statements.push(...stat.stat);
      } else {
        statements.push(stat.stat);
      }
    });
    return statements;
  }

  private extractImportDeclarations(stat: Stat): {
    imports: t.ImportDeclaration[];
    rest: t.Statement[];
  } {
    const statements = Array.isArray(stat.stat) ? stat.stat : [stat.stat];
    const imports: t.ImportDeclaration[] = [];
    const rest: t.Statement[] = [];
    statements.forEach((statement) => {
      if (t.isImportDeclaration(statement)) {
        imports.push(statement);
      } else {
        rest.push(statement);
      }
    });
    return { imports, rest };
  }

  private withStatements(stat: Stat, statements: t.Statement[]): Stat {
    if (stat.stat === statements) {
      return stat;
    }
    if (statements.length === 1) {
      return { ...stat, stat: statements[0] };
    }
    return { ...stat, stat: statements };
  }

  private collectImports(
    fragment: CodeFragment,
    fragments: Map<string, CodeFragment>,
    acc: t.ImportDeclaration[] = []
  ) {
    acc.push(...fragment.imports);
    (fragment.children ?? []).forEach((childId) => {
      const child = fragments.get(childId);
      if (!child) {
        return;
      }
      this.collectImports(child, fragments, acc);
    });
    return acc;
  }
}
