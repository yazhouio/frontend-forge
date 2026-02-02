import template from "@babel/template";
import * as t from "@babel/types";
import {
  CodeFragment,
  DataSourceDefinitionWithParseTemplate,
  NodeDefinitionWithParseTemplate,
  Stat,
} from "./interfaces.js";
import { DataSourceRegistry } from "./DataSourceRegistry.js";
import { NodeRegistry } from "./NodeRegistry.js";
import { JSX_TEMPLATE_OPTIONS, StatementScope } from "../constants.js";
import {
  ActionGraphSchema,
  BindingValue,
  ComponentNode,
  DataSourceNode,
  ExpressionValue,
  PageConfig,
} from "./JSONSchema.js";
import { SchemaValidator } from "./SchemaValidator.js";
import {
  ActionGraphEventMap,
  ActionGraphInfo,
  applyActionGraphDataSourceDependencies,
  applyActionGraphStats,
  buildActionGraphEventHandlers,
  buildActionGraphEventMap,
  buildActionGraphInfoMap,
} from "./actionGraph.js";
import {
  BindingOutputKind,
  DataSourceBindingInfo,
  getBindingOutputVarName,
  isBindingOutputDefined,
  resolveDefaultBindingOutput,
} from "./bindingTypes.js";

type BindingTargets = {
  dataSources: Map<string, Map<string, Set<BindingOutputKind>>>;
  actionGraphs: Map<string, Set<string>>;
  runtime: Set<string>;
};

type DataSourceArgsMeta = {
  args: t.Expression[];
  dependsOn: Set<string>;
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
    const dataSourceArgsMeta = this.collectDataSourceArgsMeta(
      schema,
      nodeFragments,
      bindingTargets,
      dataSourceInfo,
      actionGraphInfo
    );
    applyActionGraphDataSourceDependencies(
      bindingTargets.dataSources,
      bindingTargets.actionGraphs,
      schema.actionGraphs,
      dataSourceInfo
    );
    this.applyRuntimeTargets(nodeFragments, bindingTargets.runtime);
    this.applyRuntimeDepsFromActionGraphs(
      nodeFragments,
      bindingTargets.actionGraphs,
      schema.actionGraphs
    );
    this.applyBindingStats(
      nodeFragments,
      bindingTargets.dataSources,
      dataSourceInfo,
      dataSourceArgsMeta
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
    this.markDefaultExport(schema.root.id, nodeFragments);
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
    this.schemaValidator.validateNodeProps(
      nodeDef,
      node.props,
      `${node.type} (${node.id})`
    );
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

  private selectRuntimeProps(
    props?: ComponentNode["props"],
    runtimeSchema?: Record<string, any>
  ): Record<string, any> {
    if (!props || !runtimeSchema) {
      return {};
    }
    const selected: Record<string, any> = {};
    Object.keys(runtimeSchema).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        return;
      }
      const value = props[key];
      if (value === undefined) {
        return;
      }
      selected[key] = this.normalizeRuntimePropValue(value);
    });
    return selected;
  }

  private normalizeRuntimePropValue(value: any): any {
    if (t.isNode(value)) {
      return value;
    }
    if (typeof value === "object" && value !== null) {
      if ((value as BindingValue)?.type === "binding") {
        return this.toAstValue(value as BindingValue);
      }
      if ((value as ExpressionValue)?.type === "expression") {
        return this.toAstValue(value as ExpressionValue);
      }
    }
    return value;
  }

  private toRuntimeDepSet(value?: string[]): Set<string> | undefined {
    if (!value || !value.length) {
      return undefined;
    }
    return new Set(value);
  }

  private wrapDataSourceProps(node: DataSourceNode): Record<string, any> {
    const config = { ...node.config };
    const info =
      this.bindingContext?.dataSourceInfo.get(node.id) ??
      this.getDataSourceBindingInfo(
        node,
        this.getDataSourceOutputNames(node)
      );
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

  private getDataSourceOutputNames(dataSource: DataSourceNode): string[] {
    const dataSourceDef = this.dataSourceRegistry?.getDataSource(
      dataSource.type
    );
    const outputs = dataSourceDef?.schema.outputs;
    if (!outputs) {
      return [];
    }
    return Object.keys(outputs);
  }

  private getDataSourceBindingInfo(
    dataSource: DataSourceNode,
    outputNames: string[]
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
      outputNames,
      defaultOutput: resolveDefaultBindingOutput(outputNames),
    };
  }

  private buildDataSourceInfoMap(
    dataSources?: DataSourceNode[]
  ): Map<string, DataSourceBindingInfo> {
    const map = new Map<string, DataSourceBindingInfo>();
    (dataSources ?? []).forEach((dataSource) => {
      const outputNames = this.getDataSourceOutputNames(dataSource);
      map.set(
        dataSource.id,
        this.getDataSourceBindingInfo(dataSource, outputNames)
      );
    });
    return map;
  }

  private parseBindingPath(path?: string): string[] {
    return (path ?? "")
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private normalizeBindingTarget(
    binding: BindingValue
  ): "context" | "dataSource" | "runtime" | undefined {
    const target = binding.target?.trim();
    if (!target) {
      return undefined;
    }
    if (target === "context" || target === "dataSource" || target === "runtime") {
      return target;
    }
    throw new Error(
      `Unsupported binding target ${target} for ${binding.source ?? ""}`
    );
  }

  private resolveBindingTarget(
    binding: BindingValue,
    dataSourceInfo?: DataSourceBindingInfo,
    actionGraphInfo?: ActionGraphInfo
  ): "dataSource" | "actionGraph" | "runtime" {
    const target = this.normalizeBindingTarget(binding);
    if (target === "runtime") {
      return "runtime";
    }
    if (target === "context") {
      if (!actionGraphInfo) {
        throw new Error(
          `Binding target context requires actionGraph source ${binding.source ?? ""}`
        );
      }
      return "actionGraph";
    }
    if (target === "dataSource") {
      if (!dataSourceInfo) {
        throw new Error(
          `Binding target dataSource requires dataSource source ${binding.source ?? ""}`
        );
      }
      return "dataSource";
    }
    if (dataSourceInfo && actionGraphInfo) {
      throw new Error(
        `Binding source ${binding.source ?? ""} is ambiguous (dataSource and actionGraph)`
      );
    }
    if (actionGraphInfo) {
      return "actionGraph";
    }
    if (dataSourceInfo) {
      return "dataSource";
    }
    throw new Error(
      `Binding source ${binding.source ?? ""} not found`
    );
  }

  private normalizeActionGraphBindingPath(binding: BindingValue): string[] {
    return this.parseBindingPath(binding.path);
  }

  private resolveDataSourceBindingOutput(
    binding: BindingValue,
    info: DataSourceBindingInfo
  ): { outputName: string; pathParts: string[] } {
    const bindName =
      typeof binding.bind === "string" ? binding.bind.trim() : "";
    if (bindName) {
      if (!isBindingOutputDefined(info.outputNames, bindName)) {
        const available = info.outputNames.length
          ? ` Available outputs: ${info.outputNames.join(", ")}.`
          : "";
        throw new Error(
          `Binding output ${bindName} not found in dataSource ${binding.source}.${available}`
        );
      }
      return {
        outputName: bindName,
        pathParts: this.parseBindingPath(binding.path),
      };
    }
    const pathParts = this.parseBindingPath(binding.path);
    if (!pathParts.length) {
      if (!info.defaultOutput) {
        const available = info.outputNames.length
          ? ` Available outputs: ${info.outputNames.join(", ")}.`
          : "";
        throw new Error(
          `Binding path for ${binding.source} must specify an output.${available}`
        );
      }
      return { outputName: info.defaultOutput, pathParts };
    }
    const outputName = pathParts[0];
    if (!isBindingOutputDefined(info.outputNames, outputName)) {
      const available = info.outputNames.length
        ? ` Available outputs: ${info.outputNames.join(", ")}.`
        : "";
      throw new Error(
        `Binding output ${outputName} not found in dataSource ${binding.source}.${available}`
      );
    }
    pathParts.shift();
    return { outputName, pathParts };
  }


  private bindingToAst(binding: BindingValue): t.Expression {
    const sourceId = binding.source;
    const dataSourceInfo = sourceId
      ? this.bindingContext?.dataSourceInfo.get(sourceId)
      : undefined;
    const actionGraphInfo = sourceId
      ? this.bindingContext?.actionGraphInfo.get(sourceId)
      : undefined;
    const target = this.resolveBindingTarget(
      binding,
      dataSourceInfo,
      actionGraphInfo
    );
    if (target === "runtime") {
      const pathParts = this.parseBindingPath(binding.path);
      let expr: t.Expression = t.identifier("__runtime__");
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
    if (target === "actionGraph") {
      const pathParts = this.normalizeActionGraphBindingPath(binding);
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
      throw new Error(`Binding source ${binding.source ?? ""} not found`);
    }
    const { outputName, pathParts } = this.resolveDataSourceBindingOutput(
      binding,
      dataSourceInfo
    );
    let expr: t.Expression = t.identifier(
      getBindingOutputVarName(dataSourceInfo.baseName, outputName)
    );
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
    const sourceId = binding.source;
    const dataSourceInfo = sourceId
      ? this.bindingContext?.dataSourceInfo.get(sourceId)
      : undefined;
    const actionGraphInfo = sourceId
      ? this.bindingContext?.actionGraphInfo.get(sourceId)
      : undefined;
    const target = this.resolveBindingTarget(
      binding,
      dataSourceInfo,
      actionGraphInfo
    );
    if (target === "runtime") {
      const pathParts = this.parseBindingPath(binding.path);
      return pathParts.length > 0;
    }
    if (target === "actionGraph") {
      const pathParts = this.normalizeActionGraphBindingPath(binding);
      return pathParts.length > 0;
    }
    if (!dataSourceInfo) {
      throw new Error(`Binding source ${binding.source ?? ""} not found`);
    }
    const { pathParts } = this.resolveDataSourceBindingOutput(
      binding,
      dataSourceInfo
    );
    return pathParts.length > 0;
  }

  private toPathExpression(pathParts: string[]): t.Expression {
    return t.arrayExpression(
      pathParts.map((part) => t.stringLiteral(part))
    );
  }

  private node2codeFragment(
    nodeDef: NodeDefinitionWithParseTemplate,
    node: ComponentNode,
    overrideProps?: ComponentNode["props"]
  ): CodeFragment {
    const rawProps = overrideProps ?? node.props;
    const props = this.wrapperNodeProps(rawProps);
    const runtimeProps = this.selectRuntimeProps(
      rawProps,
      nodeDef.schema.runtimeProps
    );
    const runtimePropKeys = Object.keys(nodeDef.schema.runtimeProps ?? {});
    const runtimeDeps = this.toRuntimeDepSet(
      nodeDef.generateCode.meta?.runtimeDeps
    );
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
        runtimeProps,
        runtimePropKeys,
        runtimeDeps,
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

  private markDefaultExport(
    rootId: string,
    nodeFragments: Map<string, CodeFragment>
  ) {
    const targetId = this.resolveDefaultExportTarget(rootId, nodeFragments);
    if (!targetId) {
      return;
    }
    const target = nodeFragments.get(targetId);
    if (!target) {
      return;
    }
    target.meta.exportDefault = true;
  }

  private resolveDefaultExportTarget(
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
    const runtimeTargets = new Set<string>();
    const visit = (
      current: ComponentNode,
      currentBoundaryId: string | null
    ) => {
      const fragment = nodeFragments.get(current.id);
      const boundaryId =
        current.meta?.scope || (fragment?.meta.renderBoundary ?? false)
          ? current.id
          : currentBoundaryId;
      if (fragment?.meta.runtimeDeps?.has("runtime")) {
        if (!boundaryId) {
          throw new Error(
            "Runtime usage requires a render boundary. Add meta.scope to the root or a parent node."
          );
        }
        runtimeTargets.add(boundaryId);
      }
      const bindings = this.collectBindingsFromProps(current.props);
      if (bindings.length) {
        if (!boundaryId) {
          throw new Error(
            "Binding requires a render boundary. Add meta.scope to the root or a parent node."
          );
        }
        bindings.forEach((binding) => {
          const sourceId = binding.source;
          const info = sourceId ? dataSourceInfo.get(sourceId) : undefined;
          const graphInfo = sourceId ? actionGraphInfo.get(sourceId) : undefined;
          const target = this.resolveBindingTarget(binding, info, graphInfo);
          if (target === "runtime") {
            runtimeTargets.add(boundaryId);
            return;
          }
          if (target === "dataSource") {
            if (!info || !sourceId) {
              throw new Error(`Binding source ${binding.source ?? ""} not found`);
            }
            const { outputName } = this.resolveDataSourceBindingOutput(
              binding,
              info
            );
            const bySource = dataSourceTargets.get(boundaryId) ?? new Map();
            const outputSet = bySource.get(sourceId) ?? new Set();
            outputSet.add(outputName);
            bySource.set(sourceId, outputSet);
            dataSourceTargets.set(boundaryId, bySource);
            return;
          }
          const graphSet = actionGraphTargets.get(boundaryId) ?? new Set();
          if (!sourceId) {
            throw new Error(
              "Binding target context requires actionGraph source."
            );
          }
          graphSet.add(sourceId);
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
    return {
      dataSources: dataSourceTargets,
      actionGraphs: actionGraphTargets,
      runtime: runtimeTargets,
    };
  }

  private ensureRuntimeDeps(fragment: CodeFragment): Set<string> {
    if (!fragment.meta.runtimeDeps) {
      fragment.meta.runtimeDeps = new Set();
    }
    return fragment.meta.runtimeDeps;
  }

  private applyRuntimeTargets(
    nodeFragments: Map<string, CodeFragment>,
    runtimeTargets: Set<string>
  ) {
    runtimeTargets.forEach((boundaryId) => {
      const fragment = nodeFragments.get(boundaryId);
      if (!fragment) {
        return;
      }
      this.ensureRuntimeDeps(fragment).add("runtime");
    });
  }

  private applyRuntimeDepsFromActionGraphs(
    nodeFragments: Map<string, CodeFragment>,
    actionGraphTargets: Map<string, Set<string>>,
    actionGraphs?: ActionGraphSchema[]
  ) {
    if (!actionGraphs?.length || !actionGraphTargets.size) {
      return;
    }
    const runtimeGraphs = new Set(
      actionGraphs
        .filter((graph) => this.actionGraphUsesRuntime(graph))
        .map((graph) => graph.id)
    );
    if (!runtimeGraphs.size) {
      return;
    }
    actionGraphTargets.forEach((graphIds, boundaryId) => {
      const usesRuntime = Array.from(graphIds).some((graphId) =>
        runtimeGraphs.has(graphId)
      );
      if (!usesRuntime) {
        return;
      }
      const fragment = nodeFragments.get(boundaryId);
      if (!fragment) {
        return;
      }
      this.ensureRuntimeDeps(fragment).add("runtime");
    });
  }

  private actionGraphUsesRuntime(graph: ActionGraphSchema): boolean {
    return Object.values(graph.actions ?? {}).some((action) =>
      action.do.some(
        (step) => step.type === "navigate" || step.type === "goBack"
      )
    );
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
    dataSourceInfo: Map<string, DataSourceBindingInfo>,
    dataSourceArgsMeta: Map<string, DataSourceArgsMeta>
  ) {
    bindingTargets.forEach((sources, boundaryId) => {
      const fragment = nodeFragments.get(boundaryId);
      if (!fragment) {
        return;
      }
      fragment.stats = fragment.stats ?? [];
      const bindingStats: Stat[] = [];
      sources.forEach((outputs, sourceId) => {
        const info = dataSourceInfo.get(sourceId);
        if (!info) {
          return;
        }
        const meta = dataSourceArgsMeta.get(sourceId);
        bindingStats.push(
          this.buildHookBindingStat(
            boundaryId,
            info,
            outputs,
            meta?.args,
            meta?.dependsOn
          )
        );
      });
      if (bindingStats.length) {
        fragment.stats = [...bindingStats, ...fragment.stats];
      }
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
    outputs: Set<BindingOutputKind>,
    args?: t.Expression[],
    dependsOn?: Set<string>
  ): Stat {
    const properties: t.ObjectProperty[] = [];
    const outputNames: string[] = [];
    const addProperty = (key: string, name: string) => {
      const keyId = t.isValidIdentifier(key)
        ? t.identifier(key)
        : t.stringLiteral(key);
      const valueId = t.identifier(name);
      properties.push(
        t.objectProperty(
          keyId,
          valueId,
          false,
          t.isIdentifier(keyId) && keyId.name === valueId.name
        )
      );
      outputNames.push(name);
    };

    const outputList = Array.from(outputs);
    if (!outputList.length && info.defaultOutput) {
      outputList.push(info.defaultOutput);
    }

    outputList.forEach((outputName) => {
      addProperty(
        outputName,
        getBindingOutputVarName(info.baseName, outputName)
      );
    });

    const pattern = t.objectPattern(properties);
    const init = t.callExpression(
      t.identifier(info.hookName),
      args?.length ? args : []
    );
    const declaration = t.variableDeclaration("const", [
      t.variableDeclarator(pattern, init),
    ]);
    const depends = dependsOn
      ? Array.from(dependsOn).map(
          (sourceId) => `${boundaryId}:binding:${sourceId}`
        )
      : [];

    return {
      id: `${boundaryId}:binding:${info.id}`,
      source: `const { ${outputNames.join(", ")} } = ${info.hookName}();`,
      scope: StatementScope.FunctionBody,
      stat: declaration,
      meta: {
        output: outputNames,
        depends,
      },
    };
  }

  private collectDataSourceArgsMeta(
    schema: PageConfig,
    nodeFragments: Map<string, CodeFragment>,
    bindingTargets: BindingTargets,
    dataSourceInfo: Map<string, DataSourceBindingInfo>,
    actionGraphInfo: Map<string, ActionGraphInfo>
  ): Map<string, DataSourceArgsMeta> {
    const meta = new Map<string, DataSourceArgsMeta>();
    if (!schema.dataSources?.length) {
      return meta;
    }
    const boundaryId = this.resolveDataSourceTarget(
      schema.root.id,
      nodeFragments
    );
    if (!boundaryId) {
      return meta;
    }
    schema.dataSources.forEach((dataSource) => {
      if (!dataSource.args?.length) {
        return;
      }
      const args = dataSource.args.map((arg) => this.toAstValue(arg));
      const deps = new Set<string>();
      const bindings = this.collectBindingsFromProps({ args: dataSource.args });
      bindings.forEach((binding) => {
        const sourceId = binding.source;
        const info = sourceId ? dataSourceInfo.get(sourceId) : undefined;
        const graphInfo = sourceId ? actionGraphInfo.get(sourceId) : undefined;
        const target = this.resolveBindingTarget(binding, info, graphInfo);
        if (target === "runtime") {
          bindingTargets.runtime.add(boundaryId);
          return;
        }
        if (target === "dataSource") {
          if (!info || !sourceId) {
            throw new Error(`Binding source ${binding.source ?? ""} not found`);
          }
          const { outputName } = this.resolveDataSourceBindingOutput(
            binding,
            info
          );
          const bySource = bindingTargets.dataSources.get(boundaryId) ?? new Map();
          const outputSet = bySource.get(sourceId) ?? new Set();
          outputSet.add(outputName);
          bySource.set(sourceId, outputSet);
          bindingTargets.dataSources.set(boundaryId, bySource);
          deps.add(sourceId);
          return;
        }
        if (!sourceId) {
          throw new Error(
            "Binding target context requires actionGraph source."
          );
        }
        const graphSet = bindingTargets.actionGraphs.get(boundaryId) ?? new Set();
        graphSet.add(sourceId);
        bindingTargets.actionGraphs.set(boundaryId, graphSet);
      });
      meta.set(dataSource.id, { args, dependsOn: deps });
    });
    return meta;
  }
}
