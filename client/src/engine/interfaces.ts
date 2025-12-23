import type { ImportManager } from "../import";
import { HookSemantic, StatementScope } from "./constants";

export type StatementKind =
  | "state" // useState/useRef/const state
  | "derived" // derived values / memo
  | "handler" // event handlers / callbacks
  | "effect" // useEffect/subscription
  | "logic" // if/switch/for/try etc.
  | "other";

export { HookSemantic, StatementScope } from "./constants";

export interface StatementWithMeta {
  /** AST 节点（建议 swc::Stmt） */
  stmt: any;

  /** 语句作用域 */
  scope: StatementScope;

  /** Hook 语义（仅 FunctionBody 有意义） */
  hook: HookSemantic;

  /** hook 排序优先级（仅 hook 有意义） */
  hookOrder?: number;

  /** 是否允许重排（hooks = false） */
  reorderable: boolean;

  /** 来源标识（Page / Component / DataSource / Slot） */
  owner?: string;
}

export interface FunctionBodyIR {
  /** Hook 区（严格顺序） */
  hooks?: StatementWithMeta[];

  /** 普通语句区 */
  body?: StatementWithMeta[];

  /** return / JSX */
  returns: StatementWithMeta[];
}

export interface FunctionIR {
  decl: StatementWithMeta; // FunctionDecl
  body: FunctionBodyIR;
  main: boolean;
}

export interface CodeFragmentIR {
  /** 模块级 import */
  imports: ImportManager;

  /** 模块级声明（无副作用） */
  moduleDecls: StatementWithMeta[];

  /** 模块初始化（有副作用） */
  moduleInits: StatementWithMeta[];

  /** 函数声明（React Component / helper） */
  functions: FunctionIR[];
}
