import { StatementScope } from "../constants";
import { DataSourceDefinition } from "../engine/interfaces";

export const StaticDataSource: DataSourceDefinition = {
  id: "static",
  schema: {
    templateInputs: {
      DATA: {
        type: "object",
        description: "Static payload",
      },
      HOOK_NAME: {
        type: "string",
        description: "Hook name",
      },
    },
  },
  generateCode: {
    imports: ['import { useState } from "react"'],
    stats: [
      {
        id: "hookDecl",
        scope: StatementScope.ModuleDecl,
        code: `const %%HOOK_NAME%% = () => {
  const [data, setData] = useState(%%DATA%%);
  return { data, error: null, isLoading: false, mutate: setData };
};`,
        output: ["HOOK_NAME"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        hookDecl: ["DATA", "HOOK_NAME"],
      },
    },
  },
};

export const RestDataSource: DataSourceDefinition = {
  id: "rest",
  schema: {
    templateInputs: {
      URL: {
        type: "string",
        description: "Request URL",
      },
      METHOD: {
        type: "string",
        description: "Request method",
      },
      HEADERS: {
        type: "object",
        description: "Request headers",
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
    ],
    meta: {
      inputPaths: {
        fetcherDecl: ["FETCHER_NAME"],
        hookDecl: ["AUTO_LOAD", "URL", "DEFAULT_VALUE", "HOOK_NAME", "FETCHER_NAME"],
      },
    },
  },
};
