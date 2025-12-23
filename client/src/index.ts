import swc from "@swc/core";
import { DEFAULT_SWC_PARSE_OPTIONS } from "./tools/swcParseOptions";

// const code = `
//     import 'reflect-metadata';
//     import React, { useState as useS, useEffect } from 'react';
//     import * as utils from './utils';
//     import { a, b as c } from 'lib';
//     import type { Foo, Bar as Baz } from './types';
//     import type * as TypeNs from './types';
//   `;

// const manager = new ImportManager(code);
// const result = manager.visitor();

// console.log(JSON.stringify(result.imports, null, 2));
// console.log(manager.toString());

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
