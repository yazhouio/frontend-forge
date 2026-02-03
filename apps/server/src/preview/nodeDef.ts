import type { NodeDefinition } from "@frontend-forge/component-generator/engine/interfaces.js";

export const CrdTableNode: NodeDefinition = {
  id: "CrdTable",
  schema: {
    templateInputs: {
      TABLE_KEY: {
        type: "string",
        description: "Table key",
      },
      TITLE: {
        type: "string",
        description: "Table title",
      },
      AUTH_KEY: {
        type: "string",
        description: "Auth key",
      },
      PARAMS: {
        type: "object",
        description: "Route params",
      },
      REFETCH: {
        type: "object",
        description: "Refetch handler",
      },
      TOOLBAR_LEFT: {
        type: "object",
        description: "Toolbar left renderer",
      },
      PAGE_CONTEXT: {
        type: "object",
        description: "Page context",
      },
      COLUMNS: {
        type: "array",
        description: "Table columns",
      },
      DATA: {
        type: "object",
        description: "Table data",
      },
      IS_LOADING: {
        type: "boolean",
        description: "Loading state",
      },
      UPDATE: {
        type: "object",
        description: "Update handler",
      },
      DEL: {
        type: "object",
        description: "Delete handler",
      },
      CREATE: {
        type: "object",
        description: "Create handler",
      },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { PageTable } from "@frontend-forge/forge-components"',
    ],
    stats: [],
    jsx: `<PageTable
  tableKey={%%TABLE_KEY%%}
  title={%%TITLE%%}
  authKey={%%AUTH_KEY%%}
  params={%%PARAMS%%}
  refetch={%%REFETCH%%}
  toolbarLeft={%%TOOLBAR_LEFT%%}
  pageContext={%%PAGE_CONTEXT%%}
  columns={%%COLUMNS%%}
  data={%%DATA%%}
  isLoading={%%IS_LOADING%%}
  update={%%UPDATE%%}
  del={%%DEL%%}
  create={%%CREATE%%}
/>`,
    meta: {
      inputPaths: {
        $jsx: [
          "TABLE_KEY",
          "TITLE",
          "AUTH_KEY",
          "PARAMS",
          "REFETCH",
          "TOOLBAR_LEFT",
          "PAGE_CONTEXT",
          "COLUMNS",
          "DATA",
          "IS_LOADING",
          "UPDATE",
          "DEL",
          "CREATE",
        ],
      },
    },
  },
};
