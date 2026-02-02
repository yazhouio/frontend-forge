import type { PageConfig } from "../engine/JSONSchema.js";

const columnsConfig = [
  {
    key: "name",
    title: "NAME",
    render: { type: "text", path: "metadata.name", payload: {} },
  },
  {
    key: "project",
    title: "Project",
    render: {
      type: "text",
      path: `metadata.annotations["meta.helm.sh/release-namespace"]`,
      payload: {},
    },
  },
  {
    key: "updatedAt",
    title: "UPDATED_AT",
    render: {
      type: "time",
      path: "metadata.creationTimestamp",
      payload: {
        format: (time: string) =>
          new Date(time).toISOString().replace("T", " ").slice(0, 19),
      },
    },
  },
];

export const workspaceTablePageConfig: PageConfig = {
  meta: {
    id: "workspace-crd-table",
    name: "Workspace CRD Table",
    title: "Workspace CRD Table",
    path: "/workspace-crd-table",
  },
  context: {},
  dataSources: [
    {
      id: "crdStoreFactory",
      type: "crd-store-factory",
      config: {
        CRD_CONFIG: {
          apiVersion: "v1alpha1",
          kind: "Demo",
          plural: "jsbundles",
          group: "extensions.kubesphere.io",
          kapi: true,
        },
        HOOK_NAME: "useCrdStoreFactory",
      },
    },
    {
      id: "runtimeParams",
      type: "crd-runtime-params",
      config: {
        HOOK_NAME: "useCrdRuntimeParams",
      },
    },
    {
      id: "columns",
      type: "crd-columns",
      config: {
        COLUMNS_CONFIG: columnsConfig,
        HOOK_NAME: "useCrdColumns",
      },
    },
    {
      id: "pageStore",
      type: "crd-page-store",
      args: [
        {
          type: "binding",
          source: "columns",
          bind: "columns",
        },
      ],
      config: {
        PAGE_ID: "workspace-forge-preview-table",
        HOOK_NAME: "useCrdPageStore",
      },
    },
    {
      id: "workspaceProjectSelect",
      type: "workspace-project-select",
      args: [
        {
          type: "binding",
          source: "runtimeParams",
          bind: "params",
        },
      ],
      config: {
        SCOPE: "namespace",
        HOOK_NAME: "useWorkspaceProjectSelect",
      },
    },
    {
      id: "mergedParams",
      type: "merge-params",
      args: [
        {
          type: "binding",
          source: "runtimeParams",
          bind: "params",
        },
        {
          type: "binding",
          source: "workspaceProjectSelect",
          bind: "params",
        },
      ],
      config: {
        HOOK_NAME: "useMergedParams",
      },
    },
    {
      id: "store",
      type: "crd-store",
      args: [
        {
          type: "binding",
          source: "crdStoreFactory",
          bind: "useStore",
        },
        {
          type: "binding",
          source: "mergedParams",
          bind: "params",
        },
        {
          type: "binding",
          source: "workspaceProjectSelect",
          bind: "namespace",
        },
        {
          type: "binding",
          source: "pageStore",
          bind: "storeQuery",
        },
      ],
      config: {
        HOOK_NAME: "useCrdStore",
      },
    },
    {
      id: "pageContext",
      type: "crd-page-context",
      config: {
        HOOK_NAME: "useCrdPageContext",
      },
    },
  ],
  root: {
    id: "workspace-crd-table-root",
    type: "CrdTable",
    props: {
      TABLE_KEY: "workspace-forge-preview-table",
      TITLE: "Table Preview",
      AUTH_KEY: "jobs",
      PARAMS: {
        type: "binding",
        source: "mergedParams",
        bind: "params",
      },
      REFETCH: {
        type: "binding",
        source: "store",
        bind: "refetch",
      },
      TOOLBAR_LEFT: {
        type: "binding",
        source: "workspaceProjectSelect",
        bind: "toolbarLeft",
      },
      PAGE_CONTEXT: {
        type: "binding",
        source: "pageContext",
        bind: "pageContext",
      },
      COLUMNS: {
        type: "binding",
        source: "columns",
        bind: "columns",
      },
      DATA: {
        type: "binding",
        source: "store",
        bind: "data",
      },
      IS_LOADING: {
        type: "binding",
        source: "store",
        bind: "loading",
        defaultValue: false,
      },
      UPDATE: {
        type: "binding",
        source: "store",
        bind: "update",
      },
      DEL: {
        type: "binding",
        source: "store",
        bind: "del",
      },
      CREATE: {
        type: "binding",
        source: "store",
        bind: "create",
      },
    },
    meta: {
      title: "CrdTable",
      scope: true,
    },
  },
};
