import type { Statement, Expression } from "@swc/core";

export type StatementKind =
  | "state" // useState/useRef/const state
  | "derived" // derived values / memo
  | "handler" // event handlers / callbacks
  | "effect" // useEffect/subscription
  | "logic" // if/switch/for/try etc.
  | "other";

export interface StatementWithMeta {
  node: Statement[];
  kind?: StatementKind;
  /**
   * normalize 时可用于“必须在谁前面”
   * 比如：derived 依赖 state
   */
  dependsOn?: string[];
  /**
   * 如果你要做更强的顺序控制（可选）
   */
  before?: string[];
  after?: string[];
}

/** -----------------------------
 * Fragment meta（控制作用域/约束）
 * ----------------------------- */
export interface CodeFragmentMeta {
  /** 调试/定位：来自哪个节点或 schema id */
  source?: string;

  /** 片段代码的“目标作用域” */
  scope?: "module" | "function" | "block";

  /**
   * 是否可能产生副作用（影响排序/合并策略）
   * 例如：立即执行表达式、订阅、polyfill 等
   */
  sideEffect?: boolean;

  /**
   * 输出策略提示（可选）
   * - 'expression': 期望用作表达式位置
   * - 'statement': 期望用作语句位置
   * - 'component': 期望最终落成 React 组件
   */
  intent?: "expression" | "statement" | "component";
}

type ImportKind = "default" | "named" | "namespace" | "side-effect";

export interface ImportSpecIR {
  /** 模块路径 */
  from: string;

  /** import React from 'react' */
  default?: string;

  /** import * as React from 'react' */
  namespace?: Set<string>;

  /**
   * import { useState, useEffect as ue } from 'react'
   * key = exported name
   * value = local alias | true (same name)
   */
  named?: Map<string, string | true>;

  /** import 'reflect-metadata' */
  sideEffect?: true;

  /** import type { Foo } from './types' */
  typeOnly?: boolean;

  /** 用于错误定位 */
  source?: {
    nodeId?: string;
    dataSourceId?: string;
  };
}

/** -----------------------------
 * ✅ 完整 CodeFragment（最终版）
 * ----------------------------- */
export interface CodeFragment {
  /** 模块级 import（会在 merge/normalize 阶段去重/合并/排序） */
  imports?: Record<string, ImportSpecIR>;

  /**
   * 语句骨架：直接用 SWC Statement AST
   * normalize 阶段可以按 kind 分区/排序
   */
  statements?: Array<Statement | StatementWithMeta>;

  /**
   * render root / expression 位置：SWC Expression AST
   * - React 组件：通常是 JSXElement/JSXFragment
   * - 也可以是任意 Expression（比如条件表达式）
   */
  jsx?: string | Expression;

  /**
   * 可选：一些地方你可能需要“表达式而不是 JSX”
   * 例如：用于生成某个 props 的值（也可以只用 jsx 字段）
   */
  expr?: Expression;

  /** 附加：注释/pragma/可选顶层声明 */
  leadingComments?: Comment[];

  /** 片段元信息 */
  meta?: CodeFragmentMeta;
}
