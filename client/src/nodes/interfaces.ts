import type { Statement } from "@swc/core";
import type {
  HookSemantic,
  StatementScope,
  StatementWithMeta,
} from "../engine/interfaces";

export type DataSourceSchema = any;

export type NodeSchema = {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: NodeSchema[];
};

export interface PageSchema {
  version: string;
  dataSources?: DataSourceSchema[];
  root: NodeSchema;
}

export interface NodeDefinition {
  id: string;
  generateCode: (
    props: Record<string, any>,
    ctx: CompileContext
  ) => LooseCodeFragmentIR;
}

export interface CompileContext {
  children?: string;
}

export interface LooseCodeFragmentIR {
  imports: string[];
  statementsWithMeta?: StatementWithMeta[];
  statements: {
    scope: StatementScope;
    hook: HookSemantic;
    code: string;
  }[];
  jsx?: string | Statement;
  meta: {
    main?: boolean;
    depends?: string[];
    renderBoundary?: boolean;
    nodeName: string;
  };
}
