import type { PageConfig } from "@frontend-forge/forge-core/advanced";

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
  [key: string]: unknown;
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
  storeOptions?: Record<string, unknown>;
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
  const pageStateArgs: Record<string, unknown>[] = [
    {
      type: "binding",
      source: "columns",
      bind: "columns",
    },
  ];
  if (scene.storeOptions !== undefined) {
    pageStateArgs.push(scene.storeOptions);
  }

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
        id: "columns",
        type: "crd-columns",
        config: {
          COLUMNS_CONFIG: columnsConfig,
          HOOK_NAME: "useCrdColumns",
        },
      },
      {
        id: "pageState",
        type: "crd-page-state",
        args: pageStateArgs,
        config: {
          PAGE_ID: scene.page.id,
          CRD_CONFIG: scene.crd,
          SCOPE: scene.scope,
          HOOK_NAME: "useCrdPageState",
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
          source: "pageState",
          bind: "params",
        },
        REFETCH: {
          type: "binding",
          source: "pageState",
          bind: "refetch",
        },
        TOOLBAR_LEFT: {
          type: "binding",
          source: "pageState",
          bind: "toolbarLeft",
        },
        PAGE_CONTEXT: {
          type: "binding",
          source: "pageState",
          bind: "pageContext",
        },
        COLUMNS: {
          type: "binding",
          source: "columns",
          bind: "columns",
        },
        DATA: {
          type: "binding",
          source: "pageState",
          bind: "data",
        },
        IS_LOADING: {
          type: "binding",
          source: "pageState",
          bind: "loading",
          defaultValue: false,
        },
        UPDATE: {
          type: "binding",
          source: "pageState",
          bind: "update",
        },
        DEL: {
          type: "binding",
          source: "pageState",
          bind: "del",
        },
        CREATE: {
          type: "binding",
          source: "pageState",
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
