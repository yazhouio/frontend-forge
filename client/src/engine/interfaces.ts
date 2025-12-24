import type { ImportManager } from "../import";
import { HookSemantic, StatementScope } from "./constants";

export type StatementKind =
  | "state"
  | "derived"
  | "handler"
  | "effect"
  | "logic"
  | "other";

export { HookSemantic, StatementScope } from "./constants";

export interface StatementWithMeta {
  stmt: any;
  scope: StatementScope;
  hook: HookSemantic;
  hookOrder?: number;
  reorderable: boolean;
  owner?: string;
}

export interface FunctionBodyIR {
  hooks?: StatementWithMeta[];
  body?: StatementWithMeta[];
  returns: StatementWithMeta[];
}

export interface FunctionIR {
  decl: StatementWithMeta;
  body: FunctionBodyIR;
  main: boolean;
}

export interface CodeFragmentIR {
  imports: ImportManager;
  moduleDecls: StatementWithMeta[];
  moduleInits: StatementWithMeta[];
  functions: FunctionIR[];
}
