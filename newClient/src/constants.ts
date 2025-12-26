import { TemplateBuilderOptions } from "@babel/template";

enum HookPriority {
  STATE = 1, // useState, useReducer
  REF = 2, // useRef
  CONTEXT = 3, // useContext
  MEMO = 4, // useMemo, useCallback
  EFFECT = 5, // useEffect, useLayoutEffect
  CUSTOM = 6, // 自定义 hooks
}

const HOOK_PRIORITY_MAP = {
  useState: HookPriority.STATE,
  useReducer: HookPriority.STATE,
  useRef: HookPriority.REF,
  useContext: HookPriority.CONTEXT,
  useMemo: HookPriority.MEMO,
  useCallback: HookPriority.MEMO,
  useEffect: HookPriority.EFFECT,
  useLayoutEffect: HookPriority.EFFECT,
};

enum StatementScope {
  ModuleImport = "module.import",
  ModuleInit = "module.init",
  ModuleDecl = "module.decl",
  FunctionDecl = "function.decl",
  FunctionBody = "function.body",
  Block = "block",
  ControlFlow = "control",
  JSX = "jsx",
}

const JSX_TEMPLATE_OPTIONS = {
  plugins: ["jsx"],
  syntacticPlaceholders: true,
} as TemplateBuilderOptions;

export {
  HookPriority,
  HOOK_PRIORITY_MAP,
  StatementScope,
  JSX_TEMPLATE_OPTIONS,
};
