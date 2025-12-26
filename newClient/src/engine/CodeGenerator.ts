import { CodeFragment, Stat } from "./interfaces";
import generate from "@babel/generator";
import * as t from "@babel/types";
import { ImportManager } from "./imports";
import { HookCollector, PreparedFragment } from "./hookCollector";

export class CodeGenerator {
  private hookCollector = new HookCollector();

  generate(fragments: Map<string, CodeFragment>): string {
    const renderFragments = Array.from(fragments.values()).filter(
      (fragment) => fragment.meta.renderBoundary
    );
    const allImports = renderFragments.flatMap((fragment) =>
      this.collectImports(fragment, fragments)
    );
    const mergedImports = ImportManager.merge(allImports);
    const prepared = new Map<string, PreparedFragment>();
    const functions = renderFragments.map((fragment) => {
      const preparedFragment = this.hookCollector.prepare(
        fragment,
        fragments,
        prepared
      );
      const orderedStats = this.hookCollector.sortStats(preparedFragment.stats);
      return this.buildFunctionDeclaration(
        preparedFragment.fragment,
        orderedStats
      );
    });

    const ast = t.file(t.program([...mergedImports, ...functions]));
    return generate(ast).code;
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
