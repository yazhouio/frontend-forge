import * as t from "@babel/types";
import { pick } from "es-toolkit";
import {
  CodeFragment,
  DataSourceDefinitionWithParseTemplate,
  NodeDefinitionWithParseTemplate,
  Stat,
} from "./interfaces";
import { DataSourceRegistry } from "./DataSourceRegistry";
import { NodeRegistry } from "./NodeRegistry";
import {
  BindingValue,
  ComponentNode,
  DataSourceNode,
  ExpressionValue,
  PageConfig,
} from "./JSONSchema";
import { SchemaValidator } from "./SchemaValidator";

export class Engine {
  nodeRegistry: NodeRegistry;
  dataSourceRegistry?: DataSourceRegistry;
  schemaValidator: SchemaValidator;

  constructor(
    nodeRegistry: NodeRegistry,
    schemaValidator: SchemaValidator,
    dataSourceRegistry?: DataSourceRegistry
  ) {
    this.nodeRegistry = nodeRegistry;
    this.schemaValidator = schemaValidator;
    this.dataSourceRegistry = dataSourceRegistry;
  }

  transform(schema: PageConfig): Map<string, CodeFragment> {
    const root = schema.root;
    const nodeFragments: Map<string, CodeFragment> = new Map();
    this.generateNodeFragments(root, nodeFragments);
    if (schema.dataSources?.length) {
      this.generateDataSourceFragments(schema, nodeFragments);
    }
    return nodeFragments;
  }

  private generateNodeFragments(
    node: ComponentNode,
    nodeFragments: Map<string, CodeFragment>
  ) {
    const nodeDef = this.nodeRegistry.getNode(node.type);
    if (!nodeDef) {
      throw new Error(`Node ${node.type} not found`);
    }
    const codeFragment = this.node2codeFragment(nodeDef, node);
    codeFragment.children = [];
    node.children?.forEach((child) => {
      this.generateNodeFragments(child, nodeFragments);
      codeFragment.children!.push(child.id);
    });
    nodeFragments.set(node.id, codeFragment);
  }

  //   private generateNodeFragment(node: ComponentNode): CodeFragment {
  //     const nodeDef = this.nodeRegistry.getNode(node.type);
  //     if (!nodeDef) {
  //       throw new Error(`Node ${node.type} not found`);
  //     }
  //     const codeFragment = this.node2codeFragment(nodeDef, node);
  //     return codeFragment;
  //   }

  private wrapperNodeProps(
    props?: ComponentNode["props"]
  ): Record<string, any> {
    return this.wrapReplacements(props);
  }

  private wrapDataSourceProps(node: DataSourceNode): Record<string, any> {
    const config = { ...node.config };
    const nameBase = this.toPascalCase(node.id);
    if (config.HOOK_NAME === undefined) {
      config.HOOK_NAME = t.identifier(`use${nameBase}`);
    } else if (typeof config.HOOK_NAME === "string") {
      config.HOOK_NAME = t.identifier(config.HOOK_NAME);
    }
    if (config.FETCHER_NAME === undefined) {
      config.FETCHER_NAME = t.identifier(`fetch${nameBase}`);
    } else if (typeof config.FETCHER_NAME === "string") {
      config.FETCHER_NAME = t.identifier(config.FETCHER_NAME);
    }
    if (config.DEFAULT_VALUE === undefined) {
      config.DEFAULT_VALUE = null;
    }
    if (config.AUTO_LOAD === undefined) {
      config.AUTO_LOAD = node.autoLoad ?? true;
    }
    if (node.polling) {
      config.POLLING_ENABLED = node.polling.enabled;
      if (node.polling.interval !== undefined) {
        config.POLLING_INTERVAL = node.polling.interval;
      }
    }
    return this.wrapReplacements(config);
  }

  private wrapReplacements(values?: Record<string, any>): Record<string, any> {
    if (!values) {
      return {};
    }
    const replacements: Record<string, any> = {};
    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      if (typeof value === "object" && value !== null) {
        if ((value as BindingValue)?.type === "binding") {
          replacements[key] = value;
          return;
        }
        if ((value as ExpressionValue)?.type === "expression") {
          replacements[key] = value;
          return;
        }
      }
      replacements[key] = this.toAstValue(value);
    });
    return replacements;
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
    switch (typeof value) {
      case "string":
        return t.stringLiteral(value);
      case "number":
        return t.numericLiteral(value);
      case "boolean":
        return t.booleanLiteral(value);
      case "object": {
        const properties = Object.entries(value).map(([key, item]) => {
          const keyNode = t.isValidIdentifier(key)
            ? t.identifier(key)
            : t.stringLiteral(key);
          return t.objectProperty(keyNode, this.toAstValue(item));
        });
        return t.objectExpression(properties);
      }
      default:
        return t.identifier("undefined");
    }
  }

  private toPascalCase(value: string): string {
    const parts = value.split(/[^a-zA-Z0-9]+/g).filter(Boolean);
    if (!parts.length) {
      return "DataSource";
    }
    return parts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  private node2codeFragment(
    nodeDef: NodeDefinitionWithParseTemplate,
    node: ComponentNode
  ): CodeFragment {
    const props = this.wrapperNodeProps(node.props);
    const imports = nodeDef.templates.imports.flatMap((importDecl) => {
      return importDecl();
    });
    const stats: Stat[] = nodeDef.templates.stats.flatMap((stat) => {
      const inputPaths = nodeDef.generateCode.meta?.inputPaths?.[stat?.id];
      const itemProps = inputPaths ? pick(props, inputPaths) : {};
      return {
        id: `${node.id}:${stat.id}`,
        source: stat.code,
        scope: stat.scope,
        stat: stat.template(itemProps),
        meta: {
          output: stat.output,
          depends: stat.depends.map((depId) => `${node.id}:${depId}`),
        },
      };
    });
    const jsxInputPaths = nodeDef.generateCode.meta?.inputPaths?.["$jsx"] ?? [];
    let jsxProps = {};
    if (jsxInputPaths.length) {
      jsxProps = pick(props, jsxInputPaths);
    }
    const jsx = nodeDef.templates.jsx?.(jsxProps);
    return {
      imports: imports,
      stats: stats,
      jsx,
      meta: {
        id: node.id,
        title: node.meta?.title,
        __config: node,
        renderBoundary: !!node.meta?.scope,
      },
    };
  }

  private generateDataSourceFragments(
    schema: PageConfig,
    nodeFragments: Map<string, CodeFragment>
  ) {
    if (!this.dataSourceRegistry) {
      throw new Error("DataSourceRegistry is required to process dataSources.");
    }
    const targetId = this.resolveDataSourceTarget(
      schema.root.id,
      nodeFragments
    );
    if (!targetId) {
      throw new Error(
        "No render boundary found for dataSources. Add meta.scope to the root or a child node."
      );
    }
    const target = nodeFragments.get(targetId);
    if (!target) {
      throw new Error(`DataSource target ${targetId} not found`);
    }
    target.children = target.children ?? [];

    schema.dataSources?.forEach((dataSource) => {
      const dataSourceDef = this.dataSourceRegistry!.getDataSource(
        dataSource.type
      );
      if (!dataSourceDef) {
        throw new Error(`DataSource ${dataSource.type} not found`);
      }
      const fragment = this.dataSource2codeFragment(dataSourceDef, dataSource);
      nodeFragments.set(fragment.meta.id, fragment);
      target.children!.push(fragment.meta.id);
    });
  }

  private resolveDataSourceTarget(
    rootId: string,
    nodeFragments: Map<string, CodeFragment>
  ): string | null {
    const rootFragment = nodeFragments.get(rootId);
    if (!rootFragment) {
      return null;
    }
    if (rootFragment.meta.renderBoundary) {
      return rootFragment.meta.id;
    }
    return this.findFirstRenderBoundary(rootFragment, nodeFragments);
  }

  private findFirstRenderBoundary(
    fragment: CodeFragment,
    nodeFragments: Map<string, CodeFragment>
  ): string | null {
    for (const childId of fragment.children ?? []) {
      const child = nodeFragments.get(childId);
      if (!child) {
        continue;
      }
      if (child.meta.renderBoundary) {
        return child.meta.id;
      }
      const candidate = this.findFirstRenderBoundary(child, nodeFragments);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  private dataSource2codeFragment(
    dataSourceDef: DataSourceDefinitionWithParseTemplate,
    dataSource: DataSourceNode
  ): CodeFragment {
    const props = this.wrapDataSourceProps(dataSource);
    const imports = dataSourceDef.templates.imports.flatMap((importDecl) => {
      return importDecl();
    });
    const fragmentId = `dataSource:${dataSource.id}`;
    const stats: Stat[] = dataSourceDef.templates.stats.flatMap((stat) => {
      const inputPaths =
        dataSourceDef.generateCode.meta?.inputPaths?.[stat?.id];
      const itemProps = inputPaths ? pick(props, inputPaths) : {};
      const outputNames = stat.output.map((name) => {
        const replacement = (itemProps as Record<string, any>)[name];
        return t.isIdentifier(replacement) ? replacement.name : name;
      });
      return {
        id: `${fragmentId}:${stat.id}`,
        source: stat.code,
        scope: stat.scope,
        stat: stat.template(itemProps),
        meta: {
          output: outputNames,
          depends: stat.depends.map((depId) => `${fragmentId}:${depId}`),
        },
      };
    });
    return {
      imports,
      stats,
      meta: {
        id: fragmentId,
        title: dataSource.id,
        __config: dataSource,
        renderBoundary: false,
      },
    };
  }
}
