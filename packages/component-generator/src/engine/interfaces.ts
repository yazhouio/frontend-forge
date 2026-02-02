import type {
  Expression,
  ImportDeclaration,
  JSXElement,
  Statement,
} from "@babel/types";
import { HookPriority, StatementScope } from "../constants.js";
import template, { PublicReplacements } from "@babel/template";
import { DataSourceDefinitionSchema, NodeDefinitionSchema } from "./JSONSchema.js";

export type NodeDefinition = {
  id: string;
  schema: NodeDefinitionSchema;
  generateCode: {
    imports: string[];
    stats: {
      id: string;
      scope: StatementScope;
      code: string;
      output: string[];
      depends: string[];
    }[];
    jsx?: string;
    meta?: {
      // depends: string[];
      inputPaths: Record<string, string[]>;
      runtimeDeps?: string[];
    };
  };
};

export type DataSourceDefinition = {
  id: string;
  schema: DataSourceDefinitionSchema;
  generateCode: {
    imports: string[];
    stats: {
      id: string;
      scope: StatementScope;
      code: string;
      output: string[];
      depends: string[];
    }[];
    meta?: {
      inputPaths: Record<string, string[]>;
      callMode?: "hook" | "value";
    };
  };
};

export interface NodeDefinitionWithParseTemplate extends NodeDefinition {
  templates: {
    imports: ParseTemplateImport[];
    stats: {
      id: string;
      scope: StatementScope;
      code: string;
      template: ParseTemplate;
      output: string[];
      depends: string[];
    }[];
    jsx?: ParseTemplateExpression;
  };
}

export interface DataSourceDefinitionWithParseTemplate
  extends DataSourceDefinition {
  templates: {
    imports: ParseTemplateImport[];
    stats: {
      id: string;
      scope: StatementScope;
      code: string;
      template: ParseTemplate;
      output: string[];
      depends: string[];
    }[];
  };
}

export type Stat = {
  id: string;
  scope: StatementScope;
  hook?: HookPriority;
  stat: Statement | Statement[];
  source: string;
  meta: {
    output: string[];
    depends: string[];
  };
};

export type CodeFragment = {
  jsx?: JSXElement;
  imports: ImportDeclaration[];
  stats: Stat[];
  slot?: Record<string, string[]>;
  children?: string[];
  meta: {
    id: string;
    title?: string;
    __config: Record<string, any>;
    // depends: string[];
    renderBoundary: boolean;
    exportDefault?: boolean;
    runtimeProps?: Record<string, any>;
    runtimePropKeys?: string[];
    runtimeDeps?: Set<string>;
  };
};

export type ParseTemplateImport = (
  arg?: PublicReplacements | undefined
) => ImportDeclaration | ImportDeclaration[];

export type ParseTemplate = (
  arg?: PublicReplacements | undefined
) => Statement | Statement[];

export type ParseTemplateExpression = (
  arg?: PublicReplacements | undefined
) => JSXElement;
