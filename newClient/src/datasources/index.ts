import { StatementScope } from "../constants";
import { DataSourceDefinition } from "../engine/interfaces";

export const StaticDataSource: DataSourceDefinition = {
  id: "static",
  schema: {
    inputs: {
      DATA: {
        type: "object",
        description: "Static payload",
      },
    },
  },
  generateCode: {
    imports: ['import { useState } from "react"'],
    stats: [
      {
        id: "dataState",
        scope: StatementScope.FunctionBody,
        code: "const [data, setData] = useState(%%DATA%%);",
        output: ["data", "setData"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        dataState: ["DATA"],
      },
    },
  },
};

export const RestDataSource: DataSourceDefinition = {
  id: "rest",
  schema: {
    inputs: {
      URL: {
        type: "string",
        description: "Request URL",
      },
      DEFAULT_VALUE: {
        type: "object",
        description: "Default response value",
      },
      AUTO_LOAD: {
        type: "boolean",
        description: "Auto load on mount",
      },
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
      FETCHER_NAME: {
        type: "string",
        description: "Fetcher name",
      },
    },
  },
  generateCode: {
    imports: ['import useSWR from "swr"'],
    stats: [
      {
        id: "fetcherDecl",
        scope: StatementScope.ModuleDecl,
        code: "const %%FETCHER_NAME%% = (url) => fetch(url).then((res) => res.json());",
        output: ["FETCHER_NAME"],
        depends: [],
      },
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = (options = {}) =>
  useSWR(
    %%AUTO_LOAD%% ? %%URL%% : null,
    %%FETCHER_NAME%%,
    { fallbackData: %%DEFAULT_VALUE%%, ...options }
  );`,
        output: ["HOOK_NAME"],
        depends: ["fetcherDecl"],
      },
      {
        id: "hookBind",
        scope: StatementScope.FunctionBody,
        code: "const { data, error, isLoading, mutate } = %%HOOK_NAME%%();",
        output: ["data", "error", "isLoading", "mutate"],
        depends: ["hookDecl"],
      },
    ],
    meta: {
      inputPaths: {
        fetcherDecl: ["FETCHER_NAME"],
        hookDecl: ["AUTO_LOAD", "URL", "DEFAULT_VALUE", "HOOK_NAME", "FETCHER_NAME"],
        hookBind: ["HOOK_NAME"],
      },
    },
  },
};
