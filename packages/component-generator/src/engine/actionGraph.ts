import template from "@babel/template";
import * as t from "@babel/types";
import { JSX_TEMPLATE_OPTIONS, StatementScope } from "../constants.js";
import {
  ActionGraphSchema,
  DataSourceNode,
  ExpressionValue,
} from "./JSONSchema.js";
import { CodeFragment, Stat } from "./interfaces.js";
import {
  BindingOutputKind,
  DataSourceBindingInfo,
  isBindingOutputDefined,
  resolveBindingOutputVarName,
} from "./bindingTypes.js";

export type ActionGraphInfo = {
  id: string;
  baseName: string;
  pascalName: string;
  storeName: string;
  contextName: string;
  setContextName: string;
  dispatchName: string;
  resolveName: string;
  getPathName: string;
  setPathName: string;
  dataSourceMapName: string;
  callDataSourceName: string;
};

export type ActionGraphEventEntry = {
  graphId: string;
  actionId: string;
};

export type ActionGraphEventMap = Map<
  string,
  Map<string, ActionGraphEventEntry[]>
>;

type ActionGraphDeps = {
  toCamelCase: (value: string) => string;
  toAstValue: (value: any) => t.Expression;
};

export const buildActionGraphInfoMap = (
  actionGraphs: ActionGraphSchema[] | undefined,
  toCamelCase: ActionGraphDeps["toCamelCase"]
): Map<string, ActionGraphInfo> => {
  const map = new Map<string, ActionGraphInfo>();
  (actionGraphs ?? []).forEach((graph) => {
    if (map.has(graph.id)) {
      throw new Error(`ActionGraph ${graph.id} already exists`);
    }
    const baseName = toCamelCase(graph.id);
    const pascalName = `${baseName.charAt(0).toUpperCase()}${baseName.slice(1)}`;
    map.set(graph.id, {
      id: graph.id,
      baseName,
      pascalName,
      storeName: `use${pascalName}Store`,
      contextName: `action${pascalName}Context`,
      setContextName: `setAction${pascalName}Context`,
      dispatchName: `dispatchAction${pascalName}`,
      resolveName: `resolveAction${pascalName}`,
      getPathName: `getAction${pascalName}Path`,
      setPathName: `setAction${pascalName}Path`,
      dataSourceMapName: `action${pascalName}DataSources`,
      callDataSourceName: `callAction${pascalName}DataSource`,
    });
  });
  return map;
};

export const buildActionGraphEventMap = (
  actionGraphs?: ActionGraphSchema[]
): ActionGraphEventMap => {
  const map: ActionGraphEventMap = new Map();
  (actionGraphs ?? []).forEach((graph) => {
    Object.entries(graph.actions ?? {}).forEach(([actionId, action]) => {
      const on = action.on ?? "";
      const parts = on.split(".").map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) {
        throw new Error(
          `Invalid action trigger "${on}" in ActionGraph ${graph.id}`
        );
      }
      const nodeId = parts[0];
      const eventName = parts.slice(1).join(".");
      const byEvent = map.get(nodeId) ?? new Map();
      const entries = byEvent.get(eventName) ?? [];
      entries.push({ graphId: graph.id, actionId });
      byEvent.set(eventName, entries);
      map.set(nodeId, byEvent);
    });
  });
  return map;
};

export const buildActionGraphEventHandlers = (
  actionGraphEvents: ActionGraphEventMap,
  actionGraphInfo: Map<string, ActionGraphInfo>
): Map<string, Record<string, ExpressionValue>> => {
  const handlers = new Map<string, Record<string, ExpressionValue>>();
  actionGraphEvents.forEach((eventMap, nodeId) => {
    const nodeHandlers: Record<string, ExpressionValue> = {};
    eventMap.forEach((entries, eventName) => {
      const propName = eventNameToPropName(eventName);
      nodeHandlers[propName] = {
        type: "expression",
        code: buildActionHandlerExpression(eventName, entries, actionGraphInfo),
      };
    });
    handlers.set(nodeId, nodeHandlers);
  });
  return handlers;
};

export const applyActionGraphDataSourceDependencies = (
  dataSourceTargets: Map<string, Map<string, Set<BindingOutputKind>>>,
  actionGraphTargets: Map<string, Set<string>>,
  actionGraphs?: ActionGraphSchema[],
  dataSourceInfo?: Map<string, DataSourceBindingInfo>
) => {
  if (!actionGraphs?.length) {
    return;
  }
  const graphById = new Map<string, ActionGraphSchema>();
  actionGraphs.forEach((graph) => graphById.set(graph.id, graph));
  actionGraphTargets.forEach((graphIds, boundaryId) => {
    graphIds.forEach((graphId) => {
      const graph = graphById.get(graphId);
      if (!graph) {
        throw new Error(`ActionGraph ${graphId} not found`);
      }
      Object.values(graph.actions ?? {}).forEach((action) => {
        action.do.forEach((step) => {
          if (step.type !== "callDataSource") {
            return;
          }
          if (dataSourceInfo) {
            const info = dataSourceInfo.get(step.id);
            if (info && !isBindingOutputDefined(info.outputNames, "mutate")) {
              throw new Error(
                `DataSource ${step.id} does not define output "mutate" required by ActionGraph`
              );
            }
          }
          const bySource = dataSourceTargets.get(boundaryId) ?? new Map();
          const outputSet = bySource.get(step.id) ?? new Set();
          outputSet.add("mutate");
          bySource.set(step.id, outputSet);
          dataSourceTargets.set(boundaryId, bySource);
        });
      });
    });
  });
};

export const applyActionGraphStats = (
  nodeFragments: Map<string, CodeFragment>,
  actionGraphTargets: Map<string, Set<string>>,
  actionGraphInfo: Map<string, ActionGraphInfo>,
  actionGraphs: ActionGraphSchema[] | undefined,
  dataSourceInfo: Map<string, DataSourceBindingInfo>,
  dataSources: DataSourceNode[] | undefined,
  toAstValue: ActionGraphDeps["toAstValue"]
) => {
  if (!actionGraphs?.length || !actionGraphTargets.size) {
    return;
  }
  const graphById = new Map<string, ActionGraphSchema>();
  actionGraphs.forEach((graph) => graphById.set(graph.id, graph));
  const dataSourceById = new Map<string, DataSourceNode>();
  (dataSources ?? []).forEach((dataSource) =>
    dataSourceById.set(dataSource.id, dataSource)
  );
  const declaredStores = new Set<string>();
  const declaredDataSources = new Set<string>();
  actionGraphTargets.forEach((graphIds, boundaryId) => {
    if (!graphIds.size) {
      return;
    }
    const fragment = nodeFragments.get(boundaryId);
    if (!fragment) {
      return;
    }
    fragment.imports = fragment.imports ?? [];
    fragment.stats = fragment.stats ?? [];
    const createImport = template.statement(
      'import { create } from "zustand"',
      JSX_TEMPLATE_OPTIONS
    )() as t.ImportDeclaration;
    const toolkitImport = template.statement(
      'import { get, set } from "es-toolkit/compat"',
      JSX_TEMPLATE_OPTIONS
    )() as t.ImportDeclaration;
    fragment.imports.push(createImport);
    fragment.imports.push(toolkitImport);
    graphIds.forEach((graphId) => {
      const graph = graphById.get(graphId);
      const info = actionGraphInfo.get(graphId);
      if (!graph || !info) {
        throw new Error(`ActionGraph ${graphId} not found`);
      }
      if (!declaredStores.has(graphId)) {
        fragment.stats.push(buildActionGraphStoreStat(graph, info, toAstValue));
        declaredStores.add(graphId);
      }
      fragment.stats.push(
        ...buildActionGraphStats(
          boundaryId,
          graph,
          info,
          declaredDataSources,
          dataSourceInfo,
          dataSourceById,
          toAstValue
        )
      );
    });
  });
};

const eventNameToPropName = (eventName: string): string => {
  const normalized = eventName.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
  return `ON_${normalized}`;
};

const stripContextPrefix = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === "context") {
    return "";
  }
  if (trimmed.startsWith("context.")) {
    return trimmed.slice(8);
  }
  return trimmed;
};

const parseActionValue = (
  value: string
): { type: "event" | "context"; path: string } | null => {
  if (value.startsWith("$event")) {
    const eventPath = value.slice(6);
    const normalized = eventPath.startsWith(".")
      ? eventPath.slice(1)
      : eventPath;
    return { type: "event", path: normalized };
  }
  if (value === "context" || value.startsWith("context.")) {
    const contextPath = value.slice(7);
    const normalized = contextPath.startsWith(".")
      ? contextPath.slice(1)
      : contextPath;
    return { type: "context", path: normalized };
  }
  return null;
};

const toActionValueExpr = (
  value: string,
  toAstValue: ActionGraphDeps["toAstValue"]
): t.Expression => {
  const parsed = parseActionValue(value);
  if (!parsed) {
    return toAstValue(value);
  }
  return t.objectExpression([
    t.objectProperty(t.identifier("type"), t.stringLiteral(parsed.type)),
    t.objectProperty(t.identifier("path"), t.stringLiteral(parsed.path)),
  ]);
};

const buildActionHandlerExpression = (
  eventName: string,
  entries: ActionGraphEventEntry[],
  actionGraphInfo: Map<string, ActionGraphInfo>
): string => {
  const payload =
    eventName === "change"
      ? "{ value: event && event.target ? event.target.value : undefined, event }"
      : "{ event }";
  const calls = entries
    .map((entry) => {
      const info = actionGraphInfo.get(entry.graphId);
      if (!info) {
        throw new Error(`ActionGraph ${entry.graphId} not found`);
      }
      return `${info.dispatchName}("${entry.actionId}", ${payload});`;
    })
    .join(" ");
  return `(event) => { ${calls} }`;
};

const buildActionGraphStoreStat = (
  graph: ActionGraphSchema,
  info: ActionGraphInfo,
  toAstValue: ActionGraphDeps["toAstValue"]
): Stat => {
  const storeTemplate = template.statement(
    `const %%STORE%% = create((set) => ({
  context: %%INITIAL_CONTEXT%%,
  setContext: (next) =>
    set((prev) => ({
      ...prev,
      context: {
        ...(prev.context || {}),
        ...(next || {}),
      },
    })),
}));`,
    JSX_TEMPLATE_OPTIONS
  );
  const storeStat = storeTemplate({
    STORE: t.identifier(info.storeName),
    INITIAL_CONTEXT: toAstValue(graph.context ?? {}),
  });

  return {
    id: `actionGraph:${graph.id}:store`,
    source: `const ${info.storeName} = create(...);`,
    scope: StatementScope.ModuleDecl,
    stat: storeStat,
    meta: {
      output: [info.storeName],
      depends: [],
    },
  };
};

const buildActionGraphStats = (
  boundaryId: string,
  graph: ActionGraphSchema,
  info: ActionGraphInfo,
  declaredDataSources: Set<string>,
  dataSourceInfo: Map<string, DataSourceBindingInfo>,
  dataSourceById: Map<string, DataSourceNode>,
  toAstValue: ActionGraphDeps["toAstValue"]
): Stat[] => {
  const prefix = `${boundaryId}:actionGraph:${graph.id}`;
  const stats: Stat[] = [];
  const storeHookTemplate = template.statement(
    "const %%CONTEXT%% = %%STORE%%((state) => state.context), %%SET_CONTEXT%% = %%STORE%%((state) => state.setContext);",
    JSX_TEMPLATE_OPTIONS
  );
  const storeHookStat = storeHookTemplate({
    CONTEXT: t.identifier(info.contextName),
    SET_CONTEXT: t.identifier(info.setContextName),
    STORE: t.identifier(info.storeName),
  });
  stats.push({
    id: `${prefix}:storeHook`,
    source: `const ${info.contextName} = ${info.storeName}(...);`,
    scope: StatementScope.FunctionBody,
    stat: storeHookStat,
    meta: {
      output: [info.contextName, info.setContextName],
      depends: [],
    },
  });

  const getPathTemplate = template.statement(
    `const %%GET_PATH%% = (target, path) => {
  if (!path) {
    return target;
  }
  return get(target, path);
};`,
    JSX_TEMPLATE_OPTIONS
  );
  const getPathStat = getPathTemplate({
    GET_PATH: t.identifier(info.getPathName),
  });
  stats.push({
    id: `${prefix}:getPath`,
    source: `const ${info.getPathName} = (target, path) => {};`,
    scope: StatementScope.FunctionBody,
    stat: getPathStat,
    meta: {
      output: [info.getPathName],
      depends: [],
    },
  });

  const resolveTemplate = template.statement(
    `const %%RESOLVE%% = (value, event, context) => {
  if (value && typeof value === "object") {
    if (value.type === "event") {
      return %%GET_PATH%%(event, value.path);
    }
    if (value.type === "context") {
      return %%GET_PATH%%(context, value.path);
    }
  }
  return value;
};`,
    JSX_TEMPLATE_OPTIONS
  );
  const resolveStat = resolveTemplate({
    RESOLVE: t.identifier(info.resolveName),
    GET_PATH: t.identifier(info.getPathName),
  });
  stats.push({
    id: `${prefix}:resolve`,
    source: `const ${info.resolveName} = (value, event, context) => {};`,
    scope: StatementScope.FunctionBody,
    stat: resolveStat,
    meta: {
      output: [info.resolveName],
      depends: [],
    },
  });

  const setPathTemplate = template.statement(
    `const %%SET_PATH%% = (target, path, value) => {
  const cleaned = String(path || "");
  if (!cleaned) {
    return value;
  }
  const base = target ? { ...target } : {};
  return set(base, cleaned, value);
};`,
    JSX_TEMPLATE_OPTIONS
  );
  const setPathStat = setPathTemplate({
    SET_PATH: t.identifier(info.setPathName),
  });
  stats.push({
    id: `${prefix}:setPath`,
    source: `const ${info.setPathName} = (target, path, value) => {};`,
    scope: StatementScope.FunctionBody,
    stat: setPathStat,
    meta: {
      output: [info.setPathName],
      depends: [],
    },
  });

  const callDataSourceStats = buildActionGraphCallDataSourceStats(
    prefix,
    info,
    graph,
    dataSourceInfo,
    dataSourceById,
    toAstValue
  );
  if (callDataSourceStats.length) {
    if (declaredDataSources.has(graph.id)) {
      stats.push(
        ...callDataSourceStats.filter(
          (stat) => stat.scope !== StatementScope.ModuleDecl
        )
      );
    } else {
      declaredDataSources.add(graph.id);
      stats.push(...callDataSourceStats);
    }
  }

  stats.push(
    buildActionGraphDispatchStat(
      prefix,
      info,
      graph,
      callDataSourceStats.length > 0,
      toAstValue
    )
  );

  return stats;
};

const buildActionGraphCallDataSourceStats = (
  prefix: string,
  info: ActionGraphInfo,
  graph: ActionGraphSchema,
  dataSourceInfo: Map<string, DataSourceBindingInfo>,
  dataSourceById: Map<string, DataSourceNode>,
  toAstValue: ActionGraphDeps["toAstValue"]
): Stat[] => {
  const dataSourceIds = new Set<string>();
  Object.values(graph.actions ?? {}).forEach((action) => {
    action.do.forEach((step) => {
      if (step.type === "callDataSource") {
        dataSourceIds.add(step.id);
      }
    });
  });
  if (!dataSourceIds.size) {
    return [];
  }

  const envId = t.identifier("env");
  const payloadId = t.identifier("payload");
  const dataSourceProps: t.ObjectProperty[] = [];
  const modeEntries: t.ObjectProperty[] = [];
  const mutateEntries: t.ObjectProperty[] = [];
  dataSourceIds.forEach((dataSourceId) => {
    const dataSource = dataSourceById.get(dataSourceId);
    const bindingInfo = dataSourceInfo.get(dataSourceId);
    if (!dataSource || !bindingInfo) {
      throw new Error(`DataSource ${dataSourceId} not found`);
    }
    mutateEntries.push(
      t.objectProperty(
        t.stringLiteral(dataSourceId),
        t.identifier(
          resolveBindingOutputVarName(bindingInfo, "mutate")
        )
      )
    );
    if (dataSource.type === "static") {
      modeEntries.push(
        t.objectProperty(t.stringLiteral(dataSourceId), t.stringLiteral("set"))
      );
      const staticBody = template.statements(
        "return payload;",
        JSX_TEMPLATE_OPTIONS
      )();
      dataSourceProps.push(
        t.objectProperty(
          t.stringLiteral(dataSourceId),
          t.arrowFunctionExpression(
            [payloadId, envId],
            t.blockStatement(staticBody as t.Statement[])
          )
        )
      );
      return;
    }
    if (dataSource.type !== "rest") {
      throw new Error(`Unsupported dataSource type ${dataSource.type}`);
    }
    modeEntries.push(
      t.objectProperty(
        t.stringLiteral(dataSourceId),
        t.stringLiteral("request")
      )
    );
    const urlValue = dataSource.config?.URL;
    if (urlValue === undefined) {
      throw new Error(`DataSource ${dataSourceId} requires URL`);
    }
    const methodValue = dataSource.config?.METHOD ?? "GET";
    const headersValue = dataSource.config?.HEADERS ?? undefined;
    const restBody = template.statements(
      `const url = %%URL%%;
const method = (%%METHOD%% || "GET").toUpperCase();
const headers = %%HEADERS%%;
const fetcher = %%FETCH%%;
const request = () => {
  if (method !== "GET") {
    return fetcher(url, {
      method,
      headers: { "Content-Type": "application/json", ...(headers || {}) },
      body: JSON.stringify(payload),
    }).then((res) => res.json());
  }
  return fetcher(url, { method, headers: headers || undefined }).then((res) =>
    res.json()
  );
};
return request();`,
      JSX_TEMPLATE_OPTIONS
    )({
      URL: toAstValue(urlValue),
      METHOD: toAstValue(methodValue),
      HEADERS: toAstValue(headersValue),
      FETCH: t.logicalExpression(
        "||",
        t.memberExpression(envId, t.identifier("fetch")),
        t.identifier("fetch")
      ),
    });
    dataSourceProps.push(
      t.objectProperty(
        t.stringLiteral(dataSourceId),
        t.arrowFunctionExpression(
          [payloadId, envId],
          t.blockStatement(restBody as t.Statement[])
        )
      )
    );
  });

  const dataSourcesDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      t.identifier(info.dataSourceMapName),
      t.objectExpression(dataSourceProps)
    ),
  ]);
  const modeMapId = t.identifier(`${info.baseName}DataSourceMode`);
  const modeMapDecl = t.variableDeclaration("const", [
    t.variableDeclarator(modeMapId, t.objectExpression(modeEntries)),
  ]);

  const callId = t.identifier(info.callDataSourceName);
  const dataSourceIdId = t.identifier("dataSourceId");
  const argsId = t.identifier("args");
  const eventId = t.identifier("event");
  const contextId = t.identifier("context");

  const resolvedArgsInit = t.callExpression(
    t.memberExpression(
      t.logicalExpression("||", argsId, t.arrayExpression([])),
      t.identifier("map")
    ),
    [
      t.arrowFunctionExpression(
        [t.identifier("arg")],
        t.callExpression(t.identifier(info.resolveName), [
          t.identifier("arg"),
          eventId,
          contextId,
        ])
      ),
    ]
  );
  const resolvedArgsDecl = t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier("resolvedArgs"), resolvedArgsInit),
  ]);
  const payloadDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      payloadId,
      t.conditionalExpression(
        t.binaryExpression(
          "<=",
          t.memberExpression(t.identifier("resolvedArgs"), t.identifier("length")),
          t.numericLiteral(1)
        ),
        t.memberExpression(t.identifier("resolvedArgs"), t.numericLiteral(0), true),
        t.identifier("resolvedArgs")
      )
    ),
  ]);
  const mutateMapId = t.identifier(`${info.baseName}DataSourceMutate`);
  const mutateMapDecl = t.variableDeclaration("const", [
    t.variableDeclarator(mutateMapId, t.objectExpression(mutateEntries)),
  ]);
  const handlerId = t.identifier("handler");
  const handlerDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      handlerId,
      t.memberExpression(t.identifier(info.dataSourceMapName), dataSourceIdId, true)
    ),
  ]);
  const modeId = t.identifier("mode");
  const modeDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      modeId,
      t.memberExpression(modeMapId, dataSourceIdId, true)
    ),
  ]);
  const envDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      envId,
      t.objectExpression([
        t.objectProperty(t.identifier("fetch"), t.identifier("fetch"), false, true),
        t.objectProperty(
          t.identifier("mutate"),
          t.memberExpression(mutateMapId, dataSourceIdId, true)
        ),
      ])
    ),
  ]);
  const effectId = t.identifier("effect");
  const effectDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      effectId,
      t.arrowFunctionExpression(
        [],
        t.callExpression(handlerId, [payloadId, envId])
      )
    ),
  ]);
  const mutateCheck = t.memberExpression(envId, t.identifier("mutate"));
  const callDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      callId,
      t.arrowFunctionExpression(
        [dataSourceIdId, argsId, eventId, contextId],
        t.blockStatement([
          resolvedArgsDecl,
          payloadDecl,
          handlerDecl,
          t.ifStatement(
            t.unaryExpression("!", handlerId),
            t.blockStatement([t.returnStatement(t.identifier("undefined"))])
          ),
          mutateMapDecl,
          modeDecl,
          envDecl,
          effectDecl,
          t.ifStatement(
            mutateCheck,
            t.blockStatement([
              t.ifStatement(
                t.binaryExpression(
                  "===",
                  modeId,
                  t.stringLiteral("set")
                ),
                t.blockStatement([
                  t.returnStatement(
                    t.callExpression(mutateCheck, [payloadId])
                  ),
                ])
              ),
              t.returnStatement(
                t.callExpression(mutateCheck, [
                  effectId,
                  t.objectExpression([
                    t.objectProperty(
                      t.identifier("revalidate"),
                      t.booleanLiteral(false)
                    ),
                  ]),
                ])
              ),
            ])
          ),
          t.returnStatement(t.callExpression(effectId, [])),
        ])
      )
    ),
  ]);

  return [
    {
      id: `${prefix}:dataSources`,
      source: `const ${info.dataSourceMapName} = {};`,
      scope: StatementScope.ModuleDecl,
      stat: [dataSourcesDecl, modeMapDecl],
      meta: {
        output: [info.dataSourceMapName, modeMapId.name],
        depends: [],
      },
    },
    {
      id: `${prefix}:callDataSource`,
      source: `const ${info.callDataSourceName} = (dataSourceId, args, event, context) => {};`,
      scope: StatementScope.FunctionBody,
      stat: callDecl,
      meta: {
        output: [info.callDataSourceName],
        depends: [],
      },
    },
  ];
};

const buildActionGraphDispatchStat = (
  prefix: string,
  info: ActionGraphInfo,
  graph: ActionGraphSchema,
  hasCallDataSource: boolean,
  toAstValue: ActionGraphDeps["toAstValue"]
): Stat => {
  const actionIdId = t.identifier("actionId");
  const eventId = t.identifier("event");
  const nextContextId = t.identifier("nextContext");
  const changedId = t.identifier("changed");
  const resultId = t.identifier("result");
  const contextId = t.identifier(info.contextName);
  const setContextId = t.identifier(info.setContextName);

  const cases: t.SwitchCase[] = [];
  Object.entries(graph.actions ?? {}).forEach(([actionId, action]) => {
    const statements: t.Statement[] = [];
    action.do.forEach((step) => {
      if (step.type === "assign") {
        const resolvedExpr = t.callExpression(t.identifier(info.resolveName), [
          toActionValueExpr(step.value, toAstValue),
          eventId,
          nextContextId,
        ]);
        const setExpr = t.callExpression(t.identifier(info.setPathName), [
          nextContextId,
          t.stringLiteral(stripContextPrefix(step.to)),
          resolvedExpr,
        ]);
        statements.push(
          t.expressionStatement(
            t.assignmentExpression("=", nextContextId, setExpr)
          )
        );
        statements.push(
          t.expressionStatement(
            t.assignmentExpression("=", changedId, t.booleanLiteral(true))
          )
        );
        return;
      }
      if (step.type === "navigate") {
        const resolvedPath = t.callExpression(t.identifier(info.resolveName), [
          toActionValueExpr(step.path, toAstValue),
          eventId,
          nextContextId,
        ]);
        const navigateExpr = t.callExpression(
          t.memberExpression(
            t.memberExpression(t.identifier("__runtime__"), t.identifier("navigation")),
            t.identifier("navigate")
          ),
          [resolvedPath]
        );
        statements.push(t.expressionStatement(navigateExpr));
        return;
      }
      if (step.type === "goBack") {
        const goBackExpr = t.callExpression(
          t.memberExpression(
            t.memberExpression(t.identifier("__runtime__"), t.identifier("navigation")),
            t.identifier("goBack")
          ),
          []
        );
        statements.push(t.expressionStatement(goBackExpr));
        return;
      }
      if (step.type === "reset") {
        const setExpr = t.callExpression(t.identifier(info.setPathName), [
          nextContextId,
          t.stringLiteral(stripContextPrefix(step.path)),
          t.stringLiteral(""),
        ]);
        statements.push(
          t.expressionStatement(
            t.assignmentExpression("=", nextContextId, setExpr)
          )
        );
        statements.push(
          t.expressionStatement(
            t.assignmentExpression("=", changedId, t.booleanLiteral(true))
          )
        );
        return;
      }
      if (step.type === "callDataSource") {
        if (!hasCallDataSource) {
          return;
        }
        const argsExpr =
          step.args && step.args.length
            ? t.arrayExpression(
                step.args.map((arg) => toActionValueExpr(arg, toAstValue))
              )
            : t.identifier("undefined");
        const callExpr = t.callExpression(
          t.identifier(info.callDataSourceName),
          [t.stringLiteral(step.id), argsExpr, eventId, nextContextId]
        );
        statements.push(
          t.expressionStatement(
            t.assignmentExpression("=", resultId, callExpr)
          )
        );
      }
    });
    statements.push(t.breakStatement());
    cases.push(
      t.switchCase(t.stringLiteral(actionId), [t.blockStatement(statements)])
    );
  });
  cases.push(t.switchCase(null, [t.breakStatement()]));

  const dispatchDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      t.identifier(info.dispatchName),
      t.arrowFunctionExpression(
        [actionIdId, eventId],
        t.blockStatement([
          t.variableDeclaration("let", [
            t.variableDeclarator(nextContextId, contextId),
          ]),
          t.variableDeclaration("let", [
            t.variableDeclarator(changedId, t.booleanLiteral(false)),
          ]),
          t.variableDeclaration("let", [t.variableDeclarator(resultId)]),
          t.switchStatement(actionIdId, cases),
          t.ifStatement(
            changedId,
            t.blockStatement([
              t.expressionStatement(
                t.callExpression(setContextId, [nextContextId])
              ),
            ])
          ),
          t.returnStatement(resultId),
        ])
      )
    ),
  ]);

  return {
    id: `${prefix}:dispatch`,
    source: `const ${info.dispatchName} = (actionId, event) => {};`,
    scope: StatementScope.FunctionBody,
    stat: dispatchDecl,
    meta: {
      output: [info.dispatchName],
      depends: [],
    },
  };
};
