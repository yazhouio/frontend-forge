import template from "@babel/template";
import * as t from "@babel/types";
import {
  CodeFragment,
  DataSourceDefinitionWithParseTemplate,
  NodeDefinitionWithParseTemplate,
  Stat,
} from "./interfaces";
import { DataSourceRegistry } from "./DataSourceRegistry";
import { NodeRegistry } from "./NodeRegistry";
import { JSX_TEMPLATE_OPTIONS, StatementScope } from "../constants";
import {
  BindingValue,
  ComponentNode,
  DataSourceNode,
  ExpressionValue,
  PageConfig,
} from "./JSONSchema";
import { SchemaValidator } from "./SchemaValidator";
import {
  ActionGraphEventMap,
  ActionGraphInfo,
  applyActionGraphDataSourceDependencies,
  applyActionGraphStats,
  buildActionGraphEventHandlers,
  buildActionGraphEventMap,
  buildActionGraphInfoMap,
} from "./actionGraph";
import { BindingOutputKind, DataSourceBindingInfo } from "./bindingTypes";

type BindingTargets = {
  dataSources: Map<string, Map<string, Set<BindingOutputKind>>>;
  actionGraphs: Map<string, Set<string>>;
};

export class Engine {
  nodeRegistry: NodeRegistry;
  dataSourceRegistry?: DataSourceRegistry;
  schemaValidator: SchemaValidator;
  private bindingContext?: {
    dataSourceInfo: Map<string, DataSourceBindingInfo>;
    actionGraphInfo: Map<string, ActionGraphInfo>;
  };

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
    const dataSourceInfo = this.buildDataSourceInfoMap(schema.dataSources);
    const actionGraphInfo = buildActionGraphInfoMap(
      schema.actionGraphs,
      this.toCamelCase.bind(this)
    );
    const actionGraphEvents = buildActionGraphEventMap(schema.actionGraphs);
    const actionGraphHandlers = buildActionGraphEventHandlers(
      actionGraphEvents,
      actionGraphInfo
    );
    this.bindingContext = { dataSourceInfo, actionGraphInfo };
    this.generateNodeFragments(root, nodeFragments, actionGraphHandlers);
    const bindingTargets = this.collectBindingTargets(
      root,
      nodeFragments,
      dataSourceInfo,
      actionGraphInfo,
      actionGraphEvents
    );
    applyActionGraphDataSourceDependencies(
      bindingTargets.dataSources,
      bindingTargets.actionGraphs,
      schema.actionGraphs
    );
    this.applyBindingStats(
      nodeFragments,
      bindingTargets.dataSources,
      dataSourceInfo
    );
    applyActionGraphStats(
      nodeFragments,
      bindingTargets.actionGraphs,
      actionGraphInfo,
      schema.actionGraphs,
      dataSourceInfo,
      schema.dataSources,
      this.toAstValue.bind(this)
    );
    const usedDataSources = this.collectUsedDataSources(
      bindingTargets.dataSources
    );
    if (schema.dataSources?.length && usedDataSources.size) {
      this.generateDataSourceFragments(
        schema,
        nodeFragments,
        usedDataSources
      );
    }
    this.bindingContext = undefined;
    return nodeFragments;
  }

  private generateNodeFragments(
    node: ComponentNode,
    nodeFragments: Map<string, CodeFragment>,
    actionGraphHandlers?: Map<string, Record<string, ExpressionValue>>
  ) {
    const nodeDef = this.nodeRegistry.getNode(node.type);
    if (!nodeDef) {
      throw new Error(`Node ${node.type} not found`);
    }
    const mergedProps = this.mergeNodeProps(
      node.props,
      actionGraphHandlers?.get(node.id)
    );
    const codeFragment = this.node2codeFragment(nodeDef, node, mergedProps);
    codeFragment.children = [];
    node.children?.forEach((child) => {
      this.generateNodeFragments(child, nodeFragments, actionGraphHandlers);
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

  private mergeNodeProps(
    baseProps?: ComponentNode["props"],
    handlerProps?: Record<string, ExpressionValue>
  ): ComponentNode["props"] {
    if (!handlerProps || !Object.keys(handlerProps).length) {
      return baseProps;
    }
    const merged = { ...(baseProps ?? {}) } as Record<string, any>;
    Object.entries(handlerProps).forEach(([key, value]) => {
      if (merged[key] === undefined) {
        merged[key] = value;
      }
    });
    return merged;
  }

  private selectInputProps(
    props: Record<string, any>,
    inputPaths: string[]
  ): Record<string, any> {
    const selected: Record<string, any> = {};
    inputPaths.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(props, key)) {
        selected[key] = props[key];
      } else {
        selected[key] = this.toAstValue(undefined);
      }
    });
    return selected;
  }

  private wrapDataSourceProps(node: DataSourceNode): Record<string, any> {
    const config = { ...node.config };
    const info =
      this.bindingContext?.dataSourceInfo.get(node.id) ??
      this.getDataSourceBindingInfo(node);
    if (config.HOOK_NAME === undefined || typeof config.HOOK_NAME === "string") {
      config.HOOK_NAME = t.identifier(info.hookName);
    }
    if (
      config.FETCHER_NAME === undefined ||
      typeof config.FETCHER_NAME === "string"
    ) {
      config.FETCHER_NAME = t.identifier(info.fetcherName);
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
          replacements[key] = this.bindingToAst(value as BindingValue);
          return;
        }
        if ((value as ExpressionValue)?.type === "expression") {
          replacements[key] = this.parseExpression(
            (value as ExpressionValue).code
          );
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
    if (typeof value === "object") {
      if ((value as BindingValue)?.type === "binding") {
        return this.bindingToAst(value as BindingValue);
      }
      if ((value as ExpressionValue)?.type === "expression") {
        return this.parseExpression((value as ExpressionValue).code);
      }
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

  private parseExpression(code: string): t.Expression {
    try {
      return template.expression(code, JSX_TEMPLATE_OPTIONS)() as t.Expression;
    } catch (error) {
      throw new Error(`Failed to parse expression: ${code}`);
    }
  }

  private toCamelCase(value: string): string {
    const pascal = this.toPascalCase(value);
    const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);
    if (t.isValidIdentifier(camel)) {
      return camel;
    }
    return `_${camel.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  }

  private getDataSourceBindingInfo(
    dataSource: DataSourceNode
  ): DataSourceBindingInfo {
    const baseName = this.toCamelCase(dataSource.id);
    const pascalName = this.toPascalCase(dataSource.id);
    const hookName =
      typeof dataSource.config?.HOOK_NAME === "string"
        ? dataSource.config.HOOK_NAME
        : `use${pascalName}`;
    const fetcherName =
      typeof dataSource.config?.FETCHER_NAME === "string"
        ? dataSource.config.FETCHER_NAME
        : `fetch${pascalName}`;
    return {
      id: dataSource.id,
      hookName,
      fetcherName,
      baseName,
      dataName: `${baseName}Data`,
      errorName: `${baseName}Error`,
      loadingName: `${baseName}Loading`,
      mutateName: `${baseName}Mutate`,
    };
  }

  private buildDataSourceInfoMap(
    dataSources?: DataSourceNode[]
  ): Map<string, DataSourceBindingInfo> {
    const map = new Map<string, DataSourceBindingInfo>();
    (dataSources ?? []).forEach((dataSource) => {
      map.set(dataSource.id, this.getDataSourceBindingInfo(dataSource));
    });
    return map;
  }


  private bindingToAst(binding: BindingValue): t.Expression {
    const dataSourceInfo = this.bindingContext?.dataSourceInfo.get(
      binding.source
    );
    const actionGraphInfo = this.bindingContext?.actionGraphInfo.get(
      binding.source
    );
    if (dataSourceInfo && actionGraphInfo) {
      throw new Error(
        `Binding source ${binding.source} is ambiguous (dataSource and actionGraph)`
      );
    }
    if (actionGraphInfo) {
      const pathParts = (binding.path ?? "")
        .split(".")
        .map((part) => part.trim())
        .filter(Boolean);
      if (pathParts[0] === "context") {
        pathParts.shift();
      }
      let expr: t.Expression = t.identifier(actionGraphInfo.contextName);
      if (pathParts.length) {
        expr = t.callExpression(t.identifier("get"), [
          expr,
          this.toPathExpression(pathParts),
        ]);
      }
      if (binding.defaultValue !== undefined) {
        return t.logicalExpression(
          "??",
          expr,
          this.toAstValue(binding.defaultValue)
        );
      }
      return expr;
    }
    if (!dataSourceInfo) {
      throw new Error(`Binding source ${binding.source} not found`);
    }
    const pathParts = (binding.path ?? "")
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);
    const baseKind = this.resolveBindingOutputKind(pathParts);
    if (pathParts[0] === baseKind) {
      pathParts.shift();
    }
    let expr: t.Expression;
    switch (baseKind) {
      case "error":
        expr = t.identifier(dataSourceInfo.errorName);
        break;
      case "isLoading":
        expr = t.identifier(dataSourceInfo.loadingName);
        break;
      case "mutate":
        expr = t.identifier(dataSourceInfo.mutateName);
        break;
      case "data":
      default:
        expr = t.identifier(dataSourceInfo.dataName);
        break;
    }
    if (pathParts.length) {
      expr = t.callExpression(t.identifier("get"), [
        expr,
        this.toPathExpression(pathParts),
      ]);
    }
    if (binding.defaultValue !== undefined) {
      return t.logicalExpression(
        "??",
        expr,
        this.toAstValue(binding.defaultValue)
      );
    }
    return expr;
  }

  private propsUseBindingPathAccess(
    props?: ComponentNode["props"]
  ): boolean {
    const bindings = this.collectBindingsFromProps(props);
    return bindings.some((binding) => this.bindingUsesPathAccess(binding));
  }

  private bindingUsesPathAccess(binding: BindingValue): boolean {
    const pathParts = (binding.path ?? "")
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!pathParts.length) {
      return false;
    }
    const isActionGraph = this.bindingContext?.actionGraphInfo.has(
      binding.source
    );
    if (isActionGraph) {
      if (pathParts[0] === "context") {
        pathParts.shift();
      }
      return pathParts.length > 0;
    }
    const baseKind = this.resolveBindingOutputKind(pathParts);
    if (pathParts[0] === baseKind) {
      pathParts.shift();
    }
    return pathParts.length > 0;
  }

  private toPathExpression(pathParts: string[]): t.Expression {
    return t.arrayExpression(
      pathParts.map((part) => t.stringLiteral(part))
    );
  }

  private resolveBindingOutputKind(pathParts: string[]): BindingOutputKind {
    const head = pathParts[0];
    if (
      head === "data" ||
      head === "error" ||
      head === "isLoading" ||
      head === "mutate"
    ) {
      return head;
    }
    return "data";
  }

  private node2codeFragment(
    nodeDef: NodeDefinitionWithParseTemplate,
    node: ComponentNode,
    overrideProps?: ComponentNode["props"]
  ): CodeFragment {
    const rawProps = overrideProps ?? node.props;
    const props = this.wrapperNodeProps(rawProps);
    const imports = nodeDef.templates.imports.flatMap((importDecl) => {
      return importDecl();
    });
    if (this.propsUseBindingPathAccess(rawProps)) {
      const toolkitImport = template.statement(
        'import { get } from "es-toolkit/compat"',
        JSX_TEMPLATE_OPTIONS
      )() as t.ImportDeclaration;
      imports.push(toolkitImport);
    }
    const stats: Stat[] = nodeDef.templates.stats.flatMap((stat) => {
      const inputPaths = nodeDef.generateCode.meta?.inputPaths?.[stat?.id];
      const itemProps = inputPaths
        ? this.selectInputProps(props, inputPaths)
        : {};
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
      jsxProps = this.selectInputProps(props, jsxInputPaths);
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
    nodeFragments: Map<string, CodeFragment>,
    usedDataSources: Set<string>
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
      if (!usedDataSources.has(dataSource.id)) {
        return;
      }
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
    if (this.propsUseBindingPathAccess(dataSource.config)) {
      const toolkitImport = template.statement(
        'import { get } from "es-toolkit/compat"',
        JSX_TEMPLATE_OPTIONS
      )() as t.ImportDeclaration;
      imports.push(toolkitImport);
    }
    const fragmentId = `dataSource:${dataSource.id}`;
    const stats: Stat[] = dataSourceDef.templates.stats.flatMap((stat) => {
      const inputPaths =
        dataSourceDef.generateCode.meta?.inputPaths?.[stat?.id];
      const itemProps = inputPaths
        ? this.selectInputProps(props, inputPaths)
        : {};
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

  private collectBindingTargets(
    node: ComponentNode,
    nodeFragments: Map<string, CodeFragment>,
    dataSourceInfo: Map<string, DataSourceBindingInfo>,
    actionGraphInfo: Map<string, ActionGraphInfo>,
    actionGraphEvents: ActionGraphEventMap
  ): BindingTargets {
    const dataSourceTargets = new Map<
      string,
      Map<string, Set<BindingOutputKind>>
    >();
    const actionGraphTargets = new Map<string, Set<string>>();
    const visit = (
      current: ComponentNode,
      currentBoundaryId: string | null
    ) => {
      const fragment = nodeFragments.get(current.id);
      const boundaryId =
        current.meta?.scope || (fragment?.meta.renderBoundary ?? false)
          ? current.id
          : currentBoundaryId;
      const bindings = this.collectBindingsFromProps(current.props);
      if (bindings.length) {
        if (!boundaryId) {
          throw new Error(
            "Binding requires a render boundary. Add meta.scope to the root or a parent node."
          );
        }
        bindings.forEach((binding) => {
          const isDataSource = dataSourceInfo.has(binding.source);
          const isActionGraph = actionGraphInfo.has(binding.source);
          if (isDataSource && isActionGraph) {
            throw new Error(
              `Binding source ${binding.source} is ambiguous (dataSource and actionGraph)`
            );
          }
          if (!isDataSource && !isActionGraph) {
            throw new Error(`Binding source ${binding.source} not found`);
          }
          if (isDataSource) {
            const outputKind = this.resolveBindingOutputKind(
              (binding.path ?? "")
                .split(".")
                .map((part) => part.trim())
                .filter(Boolean)
            );
            const bySource = dataSourceTargets.get(boundaryId) ?? new Map();
            const outputSet = bySource.get(binding.source) ?? new Set();
            outputSet.add(outputKind);
            bySource.set(binding.source, outputSet);
            dataSourceTargets.set(boundaryId, bySource);
            return;
          }
          const graphSet = actionGraphTargets.get(boundaryId) ?? new Set();
          graphSet.add(binding.source);
          actionGraphTargets.set(boundaryId, graphSet);
        });
      }
      const eventTargets = actionGraphEvents.get(current.id);
      if (eventTargets) {
        if (!boundaryId) {
          throw new Error(
            "ActionGraph events require a render boundary. Add meta.scope to the root or a parent node."
          );
        }
        const graphSet = actionGraphTargets.get(boundaryId) ?? new Set();
        eventTargets.forEach((entries) => {
          entries.forEach((entry) => graphSet.add(entry.graphId));
        });
        actionGraphTargets.set(boundaryId, graphSet);
      }
      current.children?.forEach((child) => visit(child, boundaryId));
    };
    visit(node, null);
    return { dataSources: dataSourceTargets, actionGraphs: actionGraphTargets };
  }

  private collectBindingsFromProps(props?: ComponentNode["props"]): BindingValue[] {
    if (!props) {
      return [];
    }
    const bindings: BindingValue[] = [];
    const walk = (value: any) => {
      if (value === null || value === undefined) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => walk(item));
        return;
      }
      if (typeof value === "object") {
        if ((value as BindingValue)?.type === "binding") {
          bindings.push(value as BindingValue);
          return;
        }
        if ((value as ExpressionValue)?.type === "expression") {
          return;
        }
        Object.values(value).forEach((item) => walk(item));
      }
    };
    Object.values(props).forEach((value) => walk(value));
    return bindings;
  }

  private applyBindingStats(
    nodeFragments: Map<string, CodeFragment>,
    bindingTargets: Map<string, Map<string, Set<BindingOutputKind>>>,
    dataSourceInfo: Map<string, DataSourceBindingInfo>
  ) {
    bindingTargets.forEach((sources, boundaryId) => {
      const fragment = nodeFragments.get(boundaryId);
      if (!fragment) {
        return;
      }
      fragment.stats = fragment.stats ?? [];
      sources.forEach((outputs, sourceId) => {
        const info = dataSourceInfo.get(sourceId);
        if (!info) {
          return;
        }
        fragment.stats.push(this.buildHookBindingStat(boundaryId, info, outputs));
      });
    });
  }


  private collectUsedDataSources(
    bindingTargets: Map<string, Map<string, Set<BindingOutputKind>>>
  ): Set<string> {
    const used = new Set<string>();
    bindingTargets.forEach((sources) => {
      sources.forEach((_, sourceId) => {
        used.add(sourceId);
      });
    });
    return used;
  }

  private buildHookBindingStat(
    boundaryId: string,
    info: DataSourceBindingInfo,
    outputs: Set<BindingOutputKind>
  ): Stat {
    const properties: t.ObjectProperty[] = [];
    const outputNames: string[] = [];
    const addProperty = (key: string, name: string) => {
      const keyId = t.identifier(key);
      const valueId = t.identifier(name);
      properties.push(
        t.objectProperty(keyId, valueId, false, keyId.name === valueId.name)
      );
      outputNames.push(name);
    };

    if (outputs.has("data")) {
      addProperty("data", info.dataName);
    }
    if (outputs.has("error")) {
      addProperty("error", info.errorName);
    }
    if (outputs.has("isLoading")) {
      addProperty("isLoading", info.loadingName);
    }
    if (outputs.has("mutate")) {
      addProperty("mutate", info.mutateName);
    }

    if (!properties.length) {
      addProperty("data", info.dataName);
    }

    const pattern = t.objectPattern(properties);
    const init = t.callExpression(t.identifier(info.hookName), []);
    const declaration = t.variableDeclaration("const", [
      t.variableDeclarator(pattern, init),
    ]);

    return {
      id: `${boundaryId}:binding:${info.id}`,
      source: `const { ${outputNames.join(", ")} } = ${info.hookName}();`,
      scope: StatementScope.FunctionBody,
      stat: declaration,
      meta: {
        output: outputNames,
        depends: [],
      },
    };
  }
}
