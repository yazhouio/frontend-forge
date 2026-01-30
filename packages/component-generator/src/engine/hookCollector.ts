import { CodeFragment, Stat } from "./interfaces.js";
import * as t from "@babel/types";
import traverseModule from "@babel/traverse";
import template from "@babel/template";
import {
  HookPriority,
  HOOK_PRIORITY_MAP,
  JSX_TEMPLATE_OPTIONS,
} from "../constants.js";

type TraverseFn = typeof import("@babel/traverse").default;
const traverse: TraverseFn =
  (traverseModule as unknown as { default?: TraverseFn }).default ??
  (traverseModule as unknown as TraverseFn);

export type PreparedFragment = {
  fragment: CodeFragment;
  stats: Stat[];
};

export class HookCollector {
  prepare(
    fragment: CodeFragment,
    fragments: Map<string, CodeFragment>,
    prepared: Map<string, PreparedFragment>
  ): PreparedFragment {
    return this.prepareRenderFragment(fragment, fragments, prepared);
  }

  sortStats(stats: Stat[]): Stat[] {
    stats.forEach((stat) => {
      if (stat.hook === undefined) {
        stat.hook = this.detectHookPriority(stat);
      }
    });

    const hookStats = stats.filter((stat) => stat.hook !== undefined);
    if (!hookStats.length) {
      return stats;
    }
    const normalStats = stats.filter((stat) => stat.hook === undefined);
    const hookIndex = new Map<string, number>();
    hookStats.forEach((stat, index) => {
      hookIndex.set(stat.id, index);
    });
    const hookMap = new Map<string, Stat>();
    hookStats.forEach((stat) => hookMap.set(stat.id, stat));
    const edges = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    hookStats.forEach((stat) => {
      edges.set(stat.id, new Set());
      inDegree.set(stat.id, 0);
    });

    hookStats.forEach((stat) => {
      stat.meta.depends.forEach((depId) => {
        if (!hookMap.has(depId)) {
          return;
        }
        if (!edges.get(depId)!.has(stat.id)) {
          edges.get(depId)!.add(stat.id);
          inDegree.set(stat.id, (inDegree.get(stat.id) ?? 0) + 1);
        }
      });
    });

    const compare = (a: Stat, b: Stat) => {
      const priorityDiff = (a.hook ?? 0) - (b.hook ?? 0);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return (hookIndex.get(a.id) ?? 0) - (hookIndex.get(b.id) ?? 0);
    };

    const queue = hookStats.filter((stat) => inDegree.get(stat.id) === 0);
    queue.sort(compare);

    const result: Stat[] = [];
    while (queue.length) {
      const current = queue.shift()!;
      result.push(current);
      edges.get(current.id)?.forEach((neighbor) => {
        const degree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, degree);
        if (degree === 0) {
          queue.push(hookMap.get(neighbor)!);
          queue.sort(compare);
        }
      });
    }

    if (result.length !== hookStats.length) {
      const resultIds = new Set(result.map((stat) => stat.id));
      const remaining = hookStats.filter((stat) => !resultIds.has(stat.id));
      remaining.sort(compare);
      result.push(...remaining);
    }

    return [...result, ...normalStats];
  }

  private prepareRenderFragment(
    fragment: CodeFragment,
    fragments: Map<string, CodeFragment>,
    prepared: Map<string, PreparedFragment>
  ): PreparedFragment {
    const cached = prepared.get(fragment.meta.id);
    if (cached) {
      return cached;
    }

    const usedNames = new Set<string>(["props"]);
    this.addOutputNames(fragment.stats, usedNames);

    let stats: Stat[] = [...fragment.stats];
    const children = (fragment.children ?? [])
      .map((childId) => {
        const child = fragments.get(childId);
        if (!child) {
          return null;
        }
        if (child.meta.renderBoundary) {
          this.prepareRenderFragment(child, fragments, prepared);
          return child;
        }
        const preparedChild = this.prepareInlineFragment(
          child,
          fragments,
          usedNames,
          prepared
        );
        stats = stats.concat(preparedChild.stats);
        return preparedChild.fragment;
      })
      .filter(Boolean) as CodeFragment[];

    if (fragment.jsx) {
      const childJsx = this.collectChildJsx(children);
      if (childJsx.length) {
        this.injectJsxChildren(fragment.jsx, "__ENGINE_CHILDREN__", childJsx);
      }
    }

    const result = { fragment, stats };
    prepared.set(fragment.meta.id, result);
    return result;
  }

  private prepareInlineFragment(
    fragment: CodeFragment,
    fragments: Map<string, CodeFragment>,
    usedNames: Set<string>,
    prepared: Map<string, PreparedFragment>
  ): PreparedFragment {
    const outputs = this.collectOutputNames(fragment.stats);
    const renameMap = this.buildRenameMap(outputs, usedNames, fragment.meta.id);
    if (renameMap.size) {
      this.renameFragmentBindings(fragment, renameMap);
      this.updateStatOutputs(fragment.stats, renameMap);
    }
    this.addOutputNames(fragment.stats, usedNames);

    let stats: Stat[] = [...fragment.stats];
    const children = (fragment.children ?? [])
      .map((childId) => {
        const child = fragments.get(childId);
        if (!child) {
          return null;
        }
        if (child.meta.renderBoundary) {
          this.prepareRenderFragment(child, fragments, prepared);
          return child;
        }
        const preparedChild = this.prepareInlineFragment(
          child,
          fragments,
          usedNames,
          prepared
        );
        stats = stats.concat(preparedChild.stats);
        return preparedChild.fragment;
      })
      .filter(Boolean) as CodeFragment[];

    if (fragment.jsx) {
      const childJsx = this.collectChildJsx(children);
      if (childJsx.length) {
        this.injectJsxChildren(fragment.jsx, "__ENGINE_CHILDREN__", childJsx);
      }
    }

    return { fragment, stats };
  }

  private collectOutputNames(stats: Stat[]): string[] {
    return stats.flatMap((stat) => stat.meta.output);
  }

  private addOutputNames(stats: Stat[], usedNames: Set<string>) {
    this.collectOutputNames(stats).forEach((name) => {
      usedNames.add(name);
    });
  }

  private buildRenameMap(
    outputs: string[],
    usedNames: Set<string>,
    fragmentId: string
  ): Map<string, string> {
    const renameMap = new Map<string, string>();
    const suffix = this.toIdentifierSuffix(fragmentId);
    outputs.forEach((name) => {
      if (!usedNames.has(name)) {
        return;
      }
      let candidateBase = `${name}_${suffix}`;
      if (!t.isValidIdentifier(candidateBase)) {
        candidateBase = `_${candidateBase.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      }
      let candidate = candidateBase;
      let index = 1;
      while (
        usedNames.has(candidate) ||
        Array.from(renameMap.values()).includes(candidate)
      ) {
        candidate = `${candidateBase}_${index}`;
        index += 1;
      }
      renameMap.set(name, candidate);
    });
    return renameMap;
  }

  private toIdentifierSuffix(value: string): string {
    const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "_");
    if (!cleaned) {
      return "child";
    }
    if (/^[0-9]/.test(cleaned)) {
      return `_${cleaned}`;
    }
    return cleaned;
  }

  private renameFragmentBindings(
    fragment: CodeFragment,
    renameMap: Map<string, string>
  ) {
    const body: t.Statement[] = [];
    fragment.stats.forEach((stat) => {
      if (Array.isArray(stat.stat)) {
        body.push(...stat.stat);
      } else {
        body.push(stat.stat);
      }
    });
    if (fragment.jsx) {
      body.push(t.expressionStatement(fragment.jsx));
    }
    if (!body.length) {
      return;
    }

    const file = t.file(t.program(body));
    traverse(file, {
      Program(path) {
        renameMap.forEach((newName, oldName) => {
          if (path.scope.hasBinding(oldName)) {
            path.scope.rename(oldName, newName);
          }
        });
      },
    });
  }

  private updateStatOutputs(stats: Stat[], renameMap: Map<string, string>) {
    stats.forEach((stat) => {
      if (!stat.meta.output.length) {
        return;
      }
      stat.meta.output = stat.meta.output.map(
        (name) => renameMap.get(name) ?? name
      );
    });
  }

  private detectHookPriority(stat: Stat): HookPriority | undefined {
    let priority: HookPriority | undefined;
    const body: t.Statement[] = [];
    if (Array.isArray(stat.stat)) {
      body.push(...stat.stat);
    } else {
      body.push(stat.stat);
    }

    const file = t.file(t.program(body));
    traverse(file, {
      CallExpression(path) {
        let hookName: string | undefined;
        const callee = path.node.callee;
        if (t.isIdentifier(callee)) {
          hookName = callee.name;
        } else if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.property)
        ) {
          hookName = callee.property.name;
        }
        if (!hookName) return;
        if (HOOK_PRIORITY_MAP[hookName as "useState"]) {
          priority = HOOK_PRIORITY_MAP[hookName as "useState"];
          path.stop();
          return;
        }
        if (hookName.startsWith("use")) {
          priority = HookPriority.CUSTOM;
          path.stop();
        }
      },
    });

    return priority;
  }

  private injectJsxChildren(
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

  private collectChildJsx(children: CodeFragment[]): t.JSXElement[] {
    return children
      .map((child) => this.resolveChildJsx(child))
      .filter(Boolean) as t.JSXElement[];
  }

  private resolveChildJsx(child: CodeFragment): t.JSXElement | null {
    if (child.meta.renderBoundary && child.meta.title) {
      if (!t.isValidIdentifier(child.meta.title)) {
        return child.jsx ?? null;
      }
      const attributes = this.collectChildProps(child);
      return this.createComponentElement(child.meta.title, attributes);
    }
    return child.jsx ?? null;
  }

  private collectChildProps(child: CodeFragment): t.JSXAttribute[] {
    const props = child.meta.runtimeProps;
    if (!props || typeof props !== "object") {
      return [];
    }
    return Object.entries(props)
      .map(([key, value]) => this.toJsxAttribute(key, value))
      .filter(Boolean) as t.JSXAttribute[];
  }

  private toJsxAttribute(name: string, value: any): t.JSXAttribute | null {
    if (!t.isValidIdentifier(name)) {
      return null;
    }
    const attrValue = this.toJsxAttributeValue(value);
    if (!attrValue) {
      if (value === true) {
        return t.jsxAttribute(t.jsxIdentifier(name), null);
      }
      return null;
    }
    return t.jsxAttribute(t.jsxIdentifier(name), attrValue);
  }

  private toJsxAttributeValue(
    value: any
  ): t.JSXAttribute["value"] | null {
    if (value === undefined) {
      return null;
    }
    if (value === null) {
      return t.jsxExpressionContainer(t.nullLiteral());
    }
    if (t.isJSXExpressionContainer(value)) {
      return value;
    }
    if (t.isNode(value)) {
      return t.jsxExpressionContainer(value as t.Expression);
    }
    switch (typeof value) {
      case "string":
        return t.stringLiteral(value);
      case "number":
        return t.jsxExpressionContainer(t.numericLiteral(value));
      case "boolean":
        return t.jsxExpressionContainer(t.booleanLiteral(value));
      case "object":
        return t.jsxExpressionContainer(this.toAstValue(value));
      default:
        return t.jsxExpressionContainer(t.identifier("undefined"));
    }
  }

  private toAstValue(value: any): t.Expression {
    if (t.isNode(value)) {
      return value as t.Expression;
    }
    if (value === null) {
      return t.nullLiteral();
    }
    if (Array.isArray(value)) {
      return t.arrayExpression(value.map((item) => this.toAstValue(item)));
    }
    if (typeof value === "object") {
      if ((value as { type?: string }).type === "expression") {
        const code = (value as { code?: unknown }).code;
        if (typeof code === "string") {
          return this.parseExpression(code);
        }
      }
      if ((value as { type?: string }).type === "binding") {
        return t.identifier("undefined");
      }
      const properties = Object.entries(value).map(([key, item]) => {
        const keyNode = t.isValidIdentifier(key)
          ? t.identifier(key)
          : t.stringLiteral(key);
        return t.objectProperty(keyNode, this.toAstValue(item));
      });
      return t.objectExpression(properties);
    }
    switch (typeof value) {
      case "string":
        return t.stringLiteral(value);
      case "number":
        return t.numericLiteral(value);
      case "boolean":
        return t.booleanLiteral(value);
      default:
        return t.identifier("undefined");
    }
  }

  private parseExpression(code: string): t.Expression {
    try {
      return template.expression(code, JSX_TEMPLATE_OPTIONS)() as t.Expression;
    } catch (error) {
      throw new Error(`Failed to parse expression: ${code}`);
    }
  }

  private createComponentElement(
    name: string,
    attributes: t.JSXAttribute[]
  ): t.JSXElement {
    const opening = t.jsxOpeningElement(t.jsxIdentifier(name), attributes, true);
    return t.jsxElement(opening, null, [], true);
  }
}
