import template from "@babel/template";
import * as t from "@babel/types";
import { JSX_TEMPLATE_OPTIONS, StatementScope } from "../constants";
import {
  ActionGraphSchema,
  DataSourceNode,
  ExpressionValue,
} from "./JSONSchema";
import { CodeFragment, Stat } from "./interfaces";
import { BindingOutputKind, DataSourceBindingInfo } from "./bindingTypes";

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
  actionGraphs?: ActionGraphSchema[]
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
    fragment.imports.push(createImport);
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
          dataSourceInfo,
          dataSourceById,
          toAstValue
        )
      );
    });
  });
};

const eventNameToPropName = (eventName: string): string => {
  const normalized = eventName
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase();
  return `ON_${normalized}`;
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
  setContext: (next) => set({ context: next }),
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
  const parts = path.split(".").filter(Boolean);
  return parts.reduce((acc, key) => (acc == null ? undefined : acc[key]), target);
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
  if (typeof value !== "string") {
    return value;
  }
  if (value.startsWith("$event")) {
    const eventPath = value.slice(6);
    const normalized = eventPath.startsWith(".") ? eventPath.slice(1) : eventPath;
    return %%GET_PATH%%(event, normalized);
  }
  if (value.startsWith("context")) {
    const contextPath = value.slice(7);
    const normalized = contextPath.startsWith(".") ? contextPath.slice(1) : contextPath;
    return %%GET_PATH%%(context, normalized);
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
  const cleaned = String(path || "").replace(/^context\\.?/, "");
  if (!cleaned) {
    return value;
  }
  const parts = cleaned.split(".").filter(Boolean);
  const result = Array.isArray(target) ? [...target] : { ...(target || {}) };
  let cursor = result;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const prev = cursor[key];
    const next =
      prev && typeof prev === "object"
        ? Array.isArray(prev)
          ? [...prev]
          : { ...prev }
        : {};
    cursor[key] = next;
    cursor = next;
  }
  cursor[parts[parts.length - 1]] = value;
  return result;
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

  const callDataSourceStat = buildActionGraphCallDataSourceStat(
    prefix,
    info,
    graph,
    dataSourceInfo,
    dataSourceById,
    toAstValue
  );
  if (callDataSourceStat) {
    stats.push(callDataSourceStat);
  }

  stats.push(
    buildActionGraphDispatchStat(prefix, info, graph, !!callDataSourceStat)
  );

  return stats;
};

const buildActionGraphCallDataSourceStat = (
  prefix: string,
  info: ActionGraphInfo,
  graph: ActionGraphSchema,
  dataSourceInfo: Map<string, DataSourceBindingInfo>,
  dataSourceById: Map<string, DataSourceNode>,
  toAstValue: ActionGraphDeps["toAstValue"]
): Stat | null => {
  const dataSourceIds = new Set<string>();
  Object.values(graph.actions ?? {}).forEach((action) => {
    action.do.forEach((step) => {
      if (step.type === "callDataSource") {
        dataSourceIds.add(step.id);
      }
    });
  });
  if (!dataSourceIds.size) {
    return null;
  }

  const cases: t.SwitchCase[] = [];
  dataSourceIds.forEach((dataSourceId) => {
    const dataSource = dataSourceById.get(dataSourceId);
    const bindingInfo = dataSourceInfo.get(dataSourceId);
    if (!dataSource || !bindingInfo) {
      throw new Error(`DataSource ${dataSourceId} not found`);
    }
    if (dataSource.type === "static") {
      const staticBody = template.statements(
        "return %%MUTATE%%(payload);",
        JSX_TEMPLATE_OPTIONS
      )({
        MUTATE: t.identifier(bindingInfo.mutateName),
      });
      cases.push(
        t.switchCase(t.stringLiteral(dataSourceId), [
          t.blockStatement(staticBody as t.Statement[]),
        ])
      );
      return;
    }
    if (dataSource.type !== "rest") {
      throw new Error(`Unsupported dataSource type ${dataSource.type}`);
    }
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
if (method !== "GET") {
  return %%MUTATE%%(
    () =>
      fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: JSON.stringify(payload),
      }).then((res) => res.json()),
    { revalidate: false }
  );
}
return %%MUTATE%%(
  () =>
    fetch(url, { method, headers: headers || undefined }).then((res) =>
      res.json()
    ),
  { revalidate: false }
);`,
      JSX_TEMPLATE_OPTIONS
    )({
      URL: toAstValue(urlValue),
      METHOD: toAstValue(methodValue),
      HEADERS: toAstValue(headersValue),
      MUTATE: t.identifier(bindingInfo.mutateName),
    });
    cases.push(
      t.switchCase(t.stringLiteral(dataSourceId), [
        t.blockStatement(restBody as t.Statement[]),
      ])
    );
  });

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
      t.identifier("payload"),
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
  const switchStmt = t.switchStatement(dataSourceIdId, cases);
  const callDecl = t.variableDeclaration("const", [
    t.variableDeclarator(
      callId,
      t.arrowFunctionExpression(
        [dataSourceIdId, argsId, eventId, contextId],
        t.blockStatement([
          resolvedArgsDecl,
          payloadDecl,
          switchStmt,
          t.returnStatement(t.identifier("undefined")),
        ])
      )
    ),
  ]);

  return {
    id: `${prefix}:callDataSource`,
    source: `const ${info.callDataSourceName} = (dataSourceId, args, event, context) => {};`,
    scope: StatementScope.FunctionBody,
    stat: callDecl,
    meta: {
      output: [info.callDataSourceName],
      depends: [],
    },
  };
};

const buildActionGraphDispatchStat = (
  prefix: string,
  info: ActionGraphInfo,
  graph: ActionGraphSchema,
  hasCallDataSource: boolean
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
          t.stringLiteral(step.value),
          eventId,
          nextContextId,
        ]);
        const setExpr = t.callExpression(t.identifier(info.setPathName), [
          nextContextId,
          t.stringLiteral(step.to),
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
      if (step.type === "reset") {
        const setExpr = t.callExpression(t.identifier(info.setPathName), [
          nextContextId,
          t.stringLiteral(step.path),
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
            ? t.arrayExpression(step.args.map((arg) => t.stringLiteral(arg)))
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
