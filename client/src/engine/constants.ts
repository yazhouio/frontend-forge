export enum StatementScope {
  /** import / export，仅 module 顶层 */
  ModuleImport = "module.import",

  /** 模块初始化（有副作用，顺序敏感） */
  ModuleInit = "module.init",

  /** 模块级声明（const / function / class，无立即副作用） */
  ModuleDecl = "module.decl",

  /** 函数声明本身（不含 body） */
  FunctionDecl = "function.decl",

  /** 函数体内部语句 */
  FunctionBody = "function.body",

  /** block 内（if / for / try 等） */
  Block = "block",

  /** return / throw */
  ControlFlow = "control",

  /** JSX（通常绑定 return） */
  JSX = "jsx",
}

export enum HookSemantic {
  None = "none",

  /** useContext */
  Context = "context",

  /** useState / useReducer / useRef */
  State = "state",

  /** useMemo / useCallback */
  Memo = "memo",

  /** 自定义 hook（useXxx，包括 DataSource hook） */
  Custom = "custom",

  /** useEffect / useLayoutEffect */
  Effect = "effect",
}

export const DUMMY_SPAN = { start: 0, end: 0, ctxt: 1 };
