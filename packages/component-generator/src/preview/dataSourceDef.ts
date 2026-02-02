import { StatementScope } from "../constants.js";
import type { DataSourceDefinition } from "../engine/interfaces.js";

export const CrdColumnsDataSource: DataSourceDefinition = {
  id: "crd-columns",
  schema: {
    templateInputs: {
      COLUMNS_CONFIG: {
        type: "array",
        description: "Columns config",
      },
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
    outputs: {
      columns: { type: "array" },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useMemo } from "react"',
      'import { TableTd } from "@frontend-forge/forge-components"',
    ],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = () => {
  const columnsConfig = %%COLUMNS_CONFIG%%;
  const columns = useMemo(
    () =>
      columnsConfig.map((column) => ({
        accessorKey: column.key,
        header: column.title,
        cell: (info) => (
          <TableTd meta={column.render} original={info.row.original} />
        ),
      })),
    [columnsConfig],
  );
  return { columns };
};`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["COLUMNS_CONFIG", "HOOK_NAME"],
      },
    },
  },
};

export const CrdPageStoreDataSource: DataSourceDefinition = {
  id: "crd-page-store",
  schema: {
    templateInputs: {
      PAGE_ID: {
        type: "string",
        description: "Page id",
      },
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
    outputs: {
      page: { type: "object" },
      storeQuery: { type: "object" },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useMemo } from "react"',
      'import { usePageStore, buildSearchObject } from "@frontend-forge/forge-components"',
    ],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = (columns) => {
  const pageId = %%PAGE_ID%%;
  const page = usePageStore({ pageId, columns });
  const storeQuery = useMemo(() => buildSearchObject(page, true), [page]);
  return { page, storeQuery };
};`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["PAGE_ID", "HOOK_NAME"],
      },
    },
  },
};

export const CrdRuntimeParamsDataSource: DataSourceDefinition = {
  id: "crd-runtime-params",
  schema: {
    templateInputs: {
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
    outputs: {
      params: { type: "object" },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useRuntimeContext } from "@frontend-forge/forge-components"',
    ],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = () => {
  const runtime = useRuntimeContext();
  return { params: runtime?.route?.params || {} };
};`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["HOOK_NAME"],
      },
    },
  },
};

export const WorkspaceProjectSelectDataSource: DataSourceDefinition = {
  id: "workspace-project-select",
  schema: {
    templateInputs: {
      SCOPE: {
        type: "string",
        description: "Scope name",
      },
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
    outputs: {
      params: { type: "object" },
      namespace: { type: "string" },
      cluster: { type: "string" },
      toolbarLeft: { type: "object" },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useRuntimeContext } from "@frontend-forge/forge-components"',
    ],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = (params) => {
  const runtime = useRuntimeContext();
  const cap = runtime?.capabilities || {};
  const useWorkspaceProjectSelect =
    cap.useWorkspaceProjectSelect || (() => ({ render: null, params: {} }));
  const scope = %%SCOPE%%;
  const enabled = scope === "namespace";
  const projectSelect = useWorkspaceProjectSelect({ workspace: params.workspace });
  const cluster = projectSelect.params?.cluster;
  const namespace = projectSelect.params?.namespace;
  return {
    params: { cluster, namespace },
    namespace,
    cluster,
    toolbarLeft: enabled ? projectSelect.render : null,
  };
};`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["SCOPE", "HOOK_NAME"],
      },
    },
  },
};

export const MergeParamsDataSource: DataSourceDefinition = {
  id: "merge-params",
  schema: {
    templateInputs: {
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
    outputs: {
      params: { type: "object" },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = (baseParams, extraParams) => {
  return {
    params: {
      ...(baseParams || {}),
      ...(extraParams || {}),
    },
  };
};`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["HOOK_NAME"],
      },
    },
  },
};

export const CrdProjectSelectDataSource: DataSourceDefinition = {
  id: "crd-project-select",
  schema: {
    templateInputs: {
      SCOPE: {
        type: "string",
        description: "Scope name",
      },
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
    outputs: {
      params: { type: "object" },
      namespace: { type: "string" },
      toolbarLeft: { type: "object" },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useProjectSelect } from "@frontend-forge/forge-components"',
    ],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = (params) => {
  const scope = %%SCOPE%%;
  const enabled = scope === "namespace";
  const projectSelect = useProjectSelect(
    { cluster: params.cluster },
    { enabled },
  );
  const namespace = enabled ? projectSelect.params?.namespace : undefined;
  return {
    params: { cluster: params.cluster, namespace },
    namespace,
    toolbarLeft: enabled ? projectSelect.render : null,
  };
};`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["SCOPE", "HOOK_NAME"],
      },
    },
  },
};

export const CrdStoreDataSource: DataSourceDefinition = {
  id: "crd-store",
  schema: {
    templateInputs: {
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
    outputs: {
      data: { type: "object" },
      loading: { type: "boolean" },
      refetch: { type: "object" },
      update: { type: "object" },
      del: { type: "object" },
      create: { type: "object" },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = (storeHook, params, namespace, storeQuery) => {
  const store = storeHook({
    params: { ...params, namespace },
    query: storeQuery,
  });
  return {
    data: store.data,
    loading: Boolean(store.isLoading || store.isValidating),
    refetch: store.mutate,
    update: store.update,
    del: store.batchDelete,
    create: store.create,
  };
};`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["HOOK_NAME"],
      },
    },
  },
};

export const CrdStoreFactoryDataSource: DataSourceDefinition = {
  id: "crd-store-factory",
  schema: {
    templateInputs: {
      CRD_CONFIG: {
        type: "object",
        description: "CRD store config",
      },
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
    outputs: {
      useStore: { type: "object" },
    },
  },
  generateCode: {
    imports: [
      'import { getCrdStore } from "@frontend-forge/forge-components"',
    ],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = getCrdStore(%%CRD_CONFIG%%);`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["CRD_CONFIG", "HOOK_NAME"],
      },
    },
  },
};

export const CrdPageContextDataSource: DataSourceDefinition = {
  id: "crd-page-context",
  schema: {
    templateInputs: {
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
    outputs: {
      pageContext: { type: "object" },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useRuntimeContext } from "@frontend-forge/forge-components"',
    ],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = () => {
  const runtime = useRuntimeContext();
  const cap = runtime?.capabilities || {};
  return {
    pageContext: {
      useTableActions: cap.useTableActions,
      useBatchActions: cap.useBatchActions,
      useItemActions: cap.useItemActions,
      getActions: cap.getActions,
      getLocalTime: cap.getLocalTime,
    },
  };
};`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["HOOK_NAME"],
      },
    },
  },
};
