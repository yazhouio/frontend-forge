import swc from "@swc/core";
import { DEFAULT_SWC_PARSE_OPTIONS } from "./tools/swcParseOptions";

const ast1 = swc.parseSync(
  `function Page() {
  return <div>1</div>}`,
  DEFAULT_SWC_PARSE_OPTIONS
);

let DUMMY = { start: 0, end: 0 };

const ast = swc.printSync(
  {
    type: "Script",
    span: DUMMY,
    body: [
      {
        type: "FunctionDeclaration",
        identifier: {
          type: "Identifier",
          span: DUMMY,
          ctxt: 1,
          value: "Page",
          optional: false,
        },
        declare: false,
        params: [
          {
            type: "Parameter",
            span: DUMMY,
            decorators: [],
            pat: {
              type: "Identifier",
              span: DUMMY,
              ctxt: 1,
              value: "props",
              optional: false,
            },
          },
        ],
        decorators: [],
        span: DUMMY,
        ctxt: 1,
        body: {
          type: "BlockStatement",
          span: DUMMY,
          ctxt: 1,
          stmts: [],
        },
        generator: false,
        async: false,
      },
    ],
    interpreter: "// src/index.ts",
  },
  {
    jsc: {
      parser: {
        syntax: "typescript",
        tsx: true,
        dynamicImport: true,
      },
    },
  }
);
console.log(ast.code);
