export enum StatementScope {
  ModuleImport = "module.import",
  ModuleInit = "module.init",
  ModuleDecl = "module.decl",
  FunctionDecl = "function.decl",
  FunctionBody = "function.body",
  Block = "block",
  ControlFlow = "control",
  JSX = "jsx",
}

export enum HookSemantic {
  None = "none",
  Context = "context",
  State = "state",
  Memo = "memo",
  Custom = "custom",
  Effect = "effect",
}

export const DUMMY_SPAN = { start: 0, end: 0, ctxt: 1 };
