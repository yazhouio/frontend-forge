// import { ImportManager } from "./engine/codeFragment/import";
import swc from "@swc/core";

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

const DUMMY = { start: 0, end: 0, ctxt: 0 };

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
              value: "props",
              optional: false,
            },
          },
        ],
        decorators: [],
        span: DUMMY,
        body: {
          type: "BlockStatement",
          span: DUMMY,
          stmts: [],
        },
        generator: false,
        async: false,
      },
    ],
    interpreter: "xx",
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
