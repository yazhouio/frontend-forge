import type { Statement } from "@swc/core";
import type { FunctionIR } from "../engine/interfaces";
import { createIdentifier } from "./createIdentifier";
import { DUMMY_SPAN } from "../engine/constants";

export const transformFunctionIR = (functionIR: FunctionIR): Statement[] => {
  const stmt = {
    ...functionIR.decl.stmt,
    body: {
      type: "BlockStatement",
      span: DUMMY_SPAN,
      ctxt: 1,
      stmts: [
        ...(functionIR.body.hooks?.flatMap((hook) => hook.stmt) || []),
        ...(functionIR.body.body?.flatMap((stmt) => stmt.stmt) || []),
        ...(functionIR.body.returns?.flatMap((stmt) => stmt.stmt) || []),
      ],
    },
  };
  if (!functionIR.main) {
    return [stmt];
  }
  return [
    stmt,
    {
      type: "ExportDefaultExpression",
      span: DUMMY_SPAN,
      expression: {
        ...createIdentifier(functionIR.decl?.stmt?.identifier?.value),
      },
    },
  ];
};
