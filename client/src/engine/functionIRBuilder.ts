import type { FunctionBodyIR, FunctionIR, StatementWithMeta } from "./interfaces";
import { HookSemantic, StatementScope } from "./interfaces";
import { createIdentifier } from "../tools/createIdentifier";
import { DUMMY_SPAN } from "./constants";

export class FunctionIRBuilder {
  decl?: StatementWithMeta;
  body?: FunctionBodyIR;

  constructor() {
    this.initBody();
  }

  setDecl = (name: string) => {
    this.decl = {
      stmt: {
        type: "FunctionDeclaration",
        identifier: createIdentifier(name),
        params: [
          {
            type: "Parameter",
            pat: {
              ...createIdentifier("props"),
            },
            span: DUMMY_SPAN,
            ctxt: 1,
          },
        ],
        span: DUMMY_SPAN,
        ctxt: 1,
      },
      scope: StatementScope.FunctionDecl,
      hook: HookSemantic.None,
      reorderable: true,
      owner: "FunctionIRBuilder",
    };
  };

  initBody = () => {
    this.body = {
      hooks: [],
      body: [],
      returns: [],
    };
  };

  addHook = (hook: StatementWithMeta) => {
    this.body?.hooks?.push(hook);
  };

  addBody = (stmt: StatementWithMeta) => {
    this.body?.body?.push(stmt);
  };

  addReturn = (stmt: StatementWithMeta) => {
    this.body?.returns?.push(stmt);
  };

  build = (): FunctionIR => {
    if (!this.decl || !this.body) {
      throw new Error("FunctionIRBuilder: decl or body is not set");
    }
    return {
      decl: this.decl,
      body: this.body,
      main: false,
    };
  };
}
