// import { Expression } from "@swc/core";

// type PageSchema = {
//   version: "1.0";
//   root: NodeSchema;
//   dataSource: DataSourceSchema[];
// };

// type NodeSchema = {
//   id: string;
//   type: string;
//   dataSourceId?: string;
//   props: Record<string, any>;
//   children: NodeSchema[];
// };

// type DataSourceSchema = {
//   id: string;
//   type: "static" | "remote";
//   config: any;
// };

// type ConfigSchema = {
//   fields: ConfigField[];
// };

// type ConfigField = {
//   name: string;
//   label: string;
//   type: "string" | "number" | "boolean" | "select";
//   defaultValue?: any;
//   options?: { label: string; value: any }[];
// };

// // Engine
// type Engine = {
//   registerNode: (node: NodeDefinition) => void;
//   getNode: (id: string) => NodeDefinition | undefined;
//   registerDataSource: (dataSource: DataSourceDefinition) => void;
//   render: (schema: PageSchema) => void;
//   compile: (schema: PageSchema) => string;
// };

// type NodeDefinition = {
//   readonly id: string;
//   type: string;
//   renderBoundary: boolean;
//   // editor: {
//   //   icon: string;
//   //   displayName: string;
//   //   preview: (props: Record<string, any>) => React.ReactNode;
//   //   configSchema: ConfigSchema;
//   // };
//   // render: (props: Record<string, any>, ctx: RuntimeContext) => React.ReactNode;
//   generateCode: (
//     props: Record<string, any>,
//     ctx: CompileContext
//   ) => CodeFragment;
// };

// // import { useState } from 'react'; import * as React from 'react'; import useSwr from 'swr';
// type dependency = {
//   repository: string;
//   name: string;
// };

// type CodeFragment = {
//   dependencies: string[];
//   statements: {
//     type: "const" | "data" | "hook" | "effect" | "dataSource";
//     name: string;
//     code: string;
//   }[];
//   jsx?: string;
// };

// type CompileContext = {
//   children?: Expression;
// };

// type RuntimeContext = {
//   dataSources?: Record<string, any>;
// };

// type DataSourceDefinition = {
//   id: string;
//   generateCode: (config: any) => any;
// };

// type ImportKind = "default" | "named" | "namespace" | "side-effect";

// interface ImportSpec {
//   /** 模块路径 */
//   from: string;

//   /** import React from 'react' */
//   default?: string;

//   /** import * as React from 'react' */
//   namespace?: Set<string>;

//   /**
//    * import { useState, useEffect as ue } from 'react'
//    * key = exported name
//    * value = local alias | true (same name)
//    */
//   named?: Map<string, string | true>;

//   /** import 'reflect-metadata' */
//   sideEffect?: true;

//   /** import type { Foo } from './types' */
//   typeOnly?: boolean;

//   /** 用于错误定位 */
//   source?: {
//     nodeId?: string;
//     dataSourceId?: string;
//   };
// }

// export {
//   PageSchema,
//   NodeSchema,
//   DataSourceSchema,
//   ConfigSchema,
//   ConfigField,
//   Engine,
//   NodeDefinition,
//   // CodeFragment,
//   CompileContext,
//   RuntimeContext,
//   DataSourceDefinition,
//   ImportKind,
//   ImportSpec,
// };

// export type * from "./engine/codeFragment/interfaces";

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
