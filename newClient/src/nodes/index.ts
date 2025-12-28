import { NodeDefinition } from "../engine/interfaces";
import template from "@babel/template";
import * as t from "@babel/types";
import { JSX_TEMPLATE_OPTIONS, StatementScope } from "../constants";

export const LayoutNode: NodeDefinition = {
  id: "Layout",
  schema: {},
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: `<div className='layout'><__ENGINE_CHILDREN__ />
    <div>{%%TEXT%%}</div></div>`,
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["TEXT"],
      },
    },
  },
};

const ast = template.expression(
  LayoutNode.generateCode.jsx!,
  JSX_TEMPLATE_OPTIONS
)({
  TEXT: t.stringLiteral("Hello World"),
});

export const TextNode: NodeDefinition = {
  id: "Text",
  schema: {
    inputs: {
      TEXT: {
        type: "string",
        description: "Text content",
      },
      DEFAULT_VALUE: {
        type: "number",
        description: "Default value",
      },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useState } from "react"',
    ],
    jsx: "<div>{%%TEXT%%}</div>",
    stats: [
      {
        id: "textState",
        scope: StatementScope.FunctionBody,
        code: "const [text, setText] = useState(%%DEFAULT_VALUE%%);",
        output: ["text", "setText"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        $jsx: ["TEXT"],
        textState: ["DEFAULT_VALUE"],
      },
    },
  },
};

export const CounterNode: NodeDefinition = {
  id: "Counter",
  schema: {
    inputs: {
      LABEL: {
        type: "string",
        description: "Counter label",
      },
      DEFAULT_VALUE: {
        type: "number",
        description: "Default count",
      },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useState, useMemo, useEffect } from "react"',
    ],
    jsx: "<div className='counter'><span>{%%LABEL%%}</span><strong>{countLabel}</strong></div>",
    stats: [
      {
        id: "countState",
        scope: StatementScope.FunctionBody,
        code: "const [count, setCount] = useState(%%DEFAULT_VALUE%%);",
        output: ["count", "setCount"],
        depends: [],
      },
      {
        id: "countLabelMemo",
        scope: StatementScope.FunctionBody,
        code: "const countLabel = useMemo(() => String(count), [count]);",
        output: ["countLabel"],
        depends: ["countState"],
      },
      {
        id: "logEffect",
        scope: StatementScope.FunctionBody,
        code: "useEffect(() => { console.log(countLabel); }, [countLabel]);",
        output: [],
        depends: ["countLabelMemo"],
      },
    ],
    meta: {
      inputPaths: {
        $jsx: ["LABEL"],
        countState: ["DEFAULT_VALUE"],
      },
    },
  },
};

export const ToggleNode: NodeDefinition = {
  id: "Toggle",
  schema: {
    inputs: {
      LABEL: {
        type: "string",
        description: "Toggle label",
      },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useState, useCallback } from "react"',
    ],
    jsx: "<button className='toggle' onClick={toggle}>{%%LABEL%%}: {on ? 'On' : 'Off'}</button>",
    stats: [
      {
        id: "toggleState",
        scope: StatementScope.FunctionBody,
        code: "const [on, setOn] = useState(false);",
        output: ["on", "setOn"],
        depends: [],
      },
      {
        id: "toggleCallback",
        scope: StatementScope.FunctionBody,
        code: "const toggle = useCallback(() => setOn((prev) => !prev), []);",
        output: ["toggle"],
        depends: ["toggleState"],
      },
    ],
    meta: {
      inputPaths: {
        $jsx: ["LABEL"],
      },
    },
  },
};

export const ScopedNode: NodeDefinition = {
  id: "Scoped",
  schema: {
    inputs: {
      LABEL: {
        type: "string",
        description: "Scoped label",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: "<div className='scoped' data-id={scopedId}>{jsxSuffix}</div>",
    stats: [
      {
        id: "moduleImport",
        scope: StatementScope.ModuleImport,
        code: 'import { useRef, useMemo, useEffect } from "react";',
        output: [],
        depends: [],
      },
      {
        id: "moduleDecl",
        scope: StatementScope.ModuleDecl,
        code: 'const moduleTag = "scoped";',
        output: ["moduleTag"],
        depends: [],
      },
      {
        id: "moduleInit",
        scope: StatementScope.ModuleInit,
        code: 'const moduleValue = moduleTag + "-init";',
        output: ["moduleValue"],
        depends: ["moduleDecl"],
      },
      {
        id: "helperDecl",
        scope: StatementScope.FunctionDecl,
        code: "function formatLabel(value) { return String(value).toUpperCase(); }",
        output: ["formatLabel"],
        depends: [],
      },
      {
        id: "idHook",
        scope: StatementScope.FunctionBody,
        code: 'const scopedId = useRef("scope").current;',
        output: ["scopedId"],
        depends: [],
      },
      {
        id: "memoLabel",
        scope: StatementScope.FunctionBody,
        code: "const memoLabel = useMemo(() => formatLabel(%%LABEL%%), [%%LABEL%%]);",
        output: ["memoLabel"],
        depends: [],
      },
      {
        id: "logEffect",
        scope: StatementScope.FunctionBody,
        code: "useEffect(() => { console.log(moduleValue, memoLabel); }, [moduleValue, memoLabel]);",
        output: [],
        depends: ["memoLabel"],
      },
      {
        id: "jsxSuffix",
        scope: StatementScope.JSX,
        code: 'const jsxSuffix = `${memoLabel}-${scopedId}`;',
        output: ["jsxSuffix"],
        depends: ["memoLabel", "idHook"],
      },
    ],
    meta: {
      inputPaths: {
        $jsx: [],
        memoLabel: ["LABEL"],
      },
    },
  },
};

export const ButtonNode: NodeDefinition = {
  id: "Button",
  schema: {
    inputs: {
      TEXT: {
        type: "string",
        description: "Button label",
      },
      VARIANT: {
        type: "string",
        description: "Button className",
      },
      DISABLED: {
        type: "boolean",
        description: "Disable state",
      },
      ON_CLICK: {
        type: "object",
        description: "Click handler",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: "<button className={%%VARIANT%%} disabled={%%DISABLED%%} onClick={%%ON_CLICK%%}>{%%TEXT%%}</button>",
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["TEXT", "VARIANT", "DISABLED", "ON_CLICK"],
      },
    },
  },
};

export const InputNode: NodeDefinition = {
  id: "Input",
  schema: {
    inputs: {
      VALUE: {
        type: "string",
        description: "Input value",
      },
      PLACEHOLDER: {
        type: "string",
        description: "Input placeholder",
      },
      ON_CHANGE: {
        type: "object",
        description: "Change handler",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: "<input value={%%VALUE%%} placeholder={%%PLACEHOLDER%%} onChange={%%ON_CHANGE%%} />",
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["VALUE", "PLACEHOLDER", "ON_CHANGE"],
      },
    },
  },
};

export const ImageNode: NodeDefinition = {
  id: "Image",
  schema: {
    inputs: {
      SRC: {
        type: "string",
        description: "Image source",
      },
      ALT: {
        type: "string",
        description: "Alt text",
      },
      WIDTH: {
        type: "number",
        description: "Width",
      },
      HEIGHT: {
        type: "number",
        description: "Height",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: "<img src={%%SRC%%} alt={%%ALT%%} width={%%WIDTH%%} height={%%HEIGHT%%} />",
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["SRC", "ALT", "WIDTH", "HEIGHT"],
      },
    },
  },
};

export const CardNode: NodeDefinition = {
  id: "Card",
  schema: {
    inputs: {
      TITLE: {
        type: "string",
        description: "Card title",
      },
      SUBTITLE: {
        type: "string",
        description: "Card subtitle",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: `<section className='card'>
  <header>
    <h3>{%%TITLE%%}</h3>
    <p>{%%SUBTITLE%%}</p>
  </header>
  <div className='card-body'><__ENGINE_CHILDREN__ /></div>
</section>`,
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["TITLE", "SUBTITLE"],
      },
    },
  },
};

export const SectionNode: NodeDefinition = {
  id: "Section",
  schema: {
    inputs: {
      TITLE: {
        type: "string",
        description: "Section title",
      },
      CLASSNAME: {
        type: "string",
        description: "Section className",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: "<section className={%%CLASSNAME%%}><h2>{%%TITLE%%}</h2><__ENGINE_CHILDREN__ /></section>",
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["TITLE", "CLASSNAME"],
      },
    },
  },
};

export const TableNode: NodeDefinition = {
  id: "Table",
  schema: {
    inputs: {
      DATA: {
        type: "object",
        description: "Table data binding",
      },
      ERROR: {
        type: "object",
        description: "Error binding",
      },
      IS_LOADING: {
        type: "boolean",
        description: "Loading binding",
      },
      MUTATE: {
        type: "object",
        description: "Mutate binding",
      },
      URL: {
        type: "string",
        description: "Request URL",
      },
      COLUMNS: {
        type: "array",
        description: "Table columns",
      },
      PAGE_SIZE: {
        type: "number",
        description: "Items per page",
      },
      QUERY_PLACEHOLDER: {
        type: "string",
        description: "Search placeholder",
      },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useState, useMemo } from "react"',
    ],
    jsx: `<div className='table-node'>
  <div className='table-toolbar'>
    <input
      className='table-search'
      value={query}
      onChange={onQueryChange}
      placeholder={%%QUERY_PLACEHOLDER%%}
    />
    <div className='table-meta'>
      {tableLoading || isLoading ? "Loading..." : error ? "Load failed" : \`\${total} items\`}
    </div>
  </div>
  <div className='table-wrapper'>
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={col.width ? { width: col.width } : undefined}>
              {col.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row, rowIndex) => (
            <tr key={row.id ?? rowIndex}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.mapper ? col.mapper(row[col.key], row, rowIndex) : row[col.key]}
                </td>
              ))}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={columns.length}>
              {tableLoading || isLoading ? "Loading..." : "No data"}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
  <div className='table-pagination'>
    <button onClick={onPrev} disabled={page <= 1}>
      Prev
    </button>
    <span>
      Page {page} / {totalPages}
    </span>
    <button onClick={onNext} disabled={page >= totalPages}>
      Next
    </button>
  </div>
</div>`,
    stats: [
      {
        id: "tableState",
        scope: StatementScope.FunctionBody,
        code: `const columns = %%COLUMNS%%,
  [query, setQuery] = useState(""),
  [page, setPage] = useState(1),
  pageSize = %%PAGE_SIZE%%,
  [tableLoading, setTableLoading] = useState(false);`,
        output: [
          "columns",
          "query",
          "setQuery",
          "page",
          "setPage",
          "pageSize",
          "tableLoading",
          "setTableLoading",
        ],
        depends: [],
      },
      {
        id: "bindingState",
        scope: StatementScope.FunctionBody,
        code: "const data = %%DATA%%, error = %%ERROR%%, isLoading = %%IS_LOADING%%, mutate = %%MUTATE%%;",
        output: ["data", "error", "isLoading", "mutate"],
        depends: [],
      },
      {
        id: "rowsCalc",
        scope: StatementScope.FunctionBody,
        code: `const rows = (() => {
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.items)) {
    return data.items;
  }
  if (Array.isArray(data.list)) {
    return data.list;
  }
  if (Array.isArray(data.data)) {
    return data.data;
  }
  return [];
})();`,
        output: ["rows"],
        depends: ["bindingState"],
      },
      {
        id: "totalCalc",
        scope: StatementScope.FunctionBody,
        code: `const total = (() => {
  if (!data) {
    return rows.length;
  }
  if (typeof data.total === "number") {
    return data.total;
  }
  if (typeof data.count === "number") {
    return data.count;
  }
  return rows.length;
})();`,
        output: ["total"],
        depends: ["rowsCalc"],
      },
      {
        id: "totalPages",
        scope: StatementScope.FunctionBody,
        code: "const totalPages = Math.max(1, Math.ceil(total / pageSize));",
        output: ["totalPages"],
        depends: ["totalCalc", "tableState"],
      },
      {
        id: "buildUrl",
        scope: StatementScope.FunctionBody,
        code: `const baseUrl = %%URL%%,
  buildUrl = (nextQuery, nextPage) => {
    const params = new URLSearchParams();
    if (nextQuery) {
      params.set("q", nextQuery);
    }
    params.set("page", String(nextPage));
    params.set("pageSize", String(pageSize));
    const queryString = params.toString();
    if (!queryString) {
      return baseUrl;
    }
    const joiner = baseUrl.includes("?") ? "&" : "?";
    return \`\${baseUrl}\${joiner}\${queryString}\`;
  };`,
        output: ["baseUrl", "buildUrl"],
        depends: ["tableState"],
      },
      {
        id: "runFetch",
        scope: StatementScope.FunctionBody,
        code: `const runFetch = (nextQuery, nextPage) => {
  const url = buildUrl(nextQuery, nextPage);
  setTableLoading(true);
  return Promise.resolve(
    mutate(() => fetch(url).then((res) => res.json()), { revalidate: false })
  ).finally(() => setTableLoading(false));
};`,
        output: ["runFetch"],
        depends: ["buildUrl", "bindingState", "tableState"],
      },
      {
        id: "queryHandler",
        scope: StatementScope.FunctionBody,
        code: `const onQueryChange = (event) => {
  const nextQuery = event.target.value;
  setQuery(nextQuery);
  setPage(1);
  runFetch(nextQuery, 1);
};`,
        output: ["onQueryChange"],
        depends: ["runFetch"],
      },
      {
        id: "prevHandler",
        scope: StatementScope.FunctionBody,
        code: `const onPrev = () => {
  const nextPage = Math.max(1, page - 1);
  if (nextPage === page) {
    return;
  }
  setPage(nextPage);
  runFetch(query, nextPage);
};`,
        output: ["onPrev"],
        depends: ["runFetch"],
      },
      {
        id: "nextHandler",
        scope: StatementScope.FunctionBody,
        code: `const onNext = () => {
  const nextPage = Math.min(totalPages, page + 1);
  if (nextPage === page) {
    return;
  }
  setPage(nextPage);
  runFetch(query, nextPage);
};`,
        output: ["onNext"],
        depends: ["runFetch", "totalPages"],
      },
    ],
    meta: {
      inputPaths: {
        $jsx: ["QUERY_PLACEHOLDER"],
        tableState: ["COLUMNS", "PAGE_SIZE"],
        bindingState: ["DATA", "ERROR", "IS_LOADING", "MUTATE"],
        buildUrl: ["URL"],
      },
    },
  },
};
