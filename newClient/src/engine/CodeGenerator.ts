import { CodeFragment } from "./interfaces";
import generate from "@babel/generator";
import * as t from "@babel/types";
import traverse from "@babel/traverse";
import { ImportManager } from "./imports";

function injectJsxChildren(
  expr: t.Expression,
  anchorName: string,
  children: t.JSXElement[]
) {
  traverse(t.file(t.program([t.expressionStatement(expr)])), {
    JSXElement(path) {
      const opening = path.node.openingElement;
      if (t.isJSXIdentifier(opening.name) && opening.name.name === anchorName) {
        path.replaceWithMultiple(children);
        path.stop();
      }
    },
  });
}

export class CodeGenerator {
  generate(fragments: Map<string, CodeFragment>): string {
    const renderFragments = Array.from(fragments.values()).filter(
      (fragment) => fragment.meta.renderBoundary
    );
    const allImports = renderFragments.flatMap((fragment) =>
      this.collectImports(fragment, fragments)
    );
    const mergedImports = ImportManager.merge(allImports);
    const functions = renderFragments.map((fragment) =>
      this.buildFunctionDeclaration(fragment, fragments)
    );

    const ast = t.file(t.program([...mergedImports, ...functions]));
    return generate(ast).code;
  }

  traverse(
    fragment: CodeFragment,
    fragments: Map<string, CodeFragment>
  ): CodeFragment {
    if (!fragment.meta.renderBoundary) {
      return fragment;
    }
    const children = (fragment.children ?? []).map((childId) => {
      return this.traverse(fragments.get(childId)!, fragments);
    });
    console.log("children", children);

    injectJsxChildren(
      fragment.jsx!,
      "__ENGINE_CHILDREN__",
      children.map((c) => c.jsx!)
    );
    return fragment;
  }

  private buildFunctionDeclaration(
    fragment: CodeFragment,
    fragments: Map<string, CodeFragment>
  ): t.FunctionDeclaration {
    const f = this.traverse(fragment, fragments);
    return t.functionDeclaration(
      t.identifier(f.meta.title!),
      [t.identifier("props")],
      t.blockStatement([
        ...f.stats.flatMap((stat) => {
          return stat.stat;
        }),
        t.returnStatement(f.jsx),
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
