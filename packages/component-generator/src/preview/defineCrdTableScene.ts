import type { PageConfig } from "../engine/JSONSchema.js";

type CrdTableScope = "namespace" | "cluster" | string;

type CrdConfig = {
  apiVersion: string;
  kind: string;
  plural: string;
  group: string;
  kapi?: boolean;
  [key: string]: unknown;
};

type CrdTablePageInfo = {
  id: string;
  title: string;
  authKey: string;
};

type CrdTableColumnRender = {
  type: "text" | "time" | "link" | string;
  path: string;
  format?: "local-datetime" | "utc" | string;
  pattern?: string;
  link?: string;
  payload?: Record<string, unknown>;
};

type CrdTableColumn = {
  key: string;
  title: string;
  render: CrdTableColumnRender;
};

export type CrdTableSceneConfig = {
  meta: {
    id: string;
    name: string;
    title?: string;
    path: string;
  };
  crd: CrdConfig;
  scope: CrdTableScope;
  page: CrdTablePageInfo;
  columns: CrdTableColumn[];
};

const buildColumnRender = (render: CrdTableColumnRender) => {
  const payload = { ...(render.payload ?? {}) };

  if (render.type === "time") {
    if (render.format) {
      payload.format = render.format;
    }
    if (render.pattern) {
      payload.pattern = render.pattern;
    }
  }

  if (render.type === "link" && render.link) {
    payload.link = render.link;
  }

  return {
    type: render.type,
    path: render.path,
    payload,
  };
};

export const defineCrdTableScene = (scene: CrdTableSceneConfig): PageConfig => {
  const columnsConfig = scene.columns.map((column) => ({
    key: column.key,
    title: column.title,
    render: buildColumnRender(column.render),
  }));

  return {
    meta: {
      id: scene.meta.id,
      name: scene.meta.name,
      title: scene.meta.title,
      path: scene.meta.path,
    },
    context: {},
    dataSources: [
      {
        id: "crdStoreFactory",
        type: "crd-store-factory",
        config: {
          CRD_CONFIG: scene.crd,
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
          PAGE_ID: scene.page.id,
          HOOK_NAME: "useCrdPageStore",
        },
      },
      {
        id: "projectSelect",
        type: "crd-project-select",
        args: [
          {
            type: "binding",
            source: "runtimeParams",
            bind: "params",
          },
        ],
        config: {
          SCOPE: scene.scope,
          HOOK_NAME: "useCrdProjectSelect",
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
            source: "runtimeParams",
            bind: "params",
          },
          {
            type: "binding",
            source: "projectSelect",
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
      id: `${scene.meta.id}-root`,
      type: "CrdTable",
      props: {
        TABLE_KEY: scene.page.id,
        TITLE: scene.page.title,
        AUTH_KEY: scene.page.authKey,
        PARAMS: {
          type: "binding",
          source: "runtimeParams",
          bind: "params",
        },
        REFETCH: {
          type: "binding",
          source: "store",
          bind: "refetch",
        },
        TOOLBAR_LEFT: {
          type: "binding",
          source: "projectSelect",
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
};
