interface BaseSchema {
  $id?: string;
  $schema?: string;
}

interface DataSchema extends BaseSchema {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, DataSchema>;
  items?: DataSchema;
  required?: string[];
  description?: string;
  $path?: string[];
}

export type NodeDefinitionSchema = {
  inputs?: Record<string, DataSchema>;
};

// 对应上面 JSON Schema 的 TypeScript 类型
export interface PageConfig {
  meta: PageMeta;
  dataSources?: DataSourceNode[];
  root: ComponentNode;
  context: Record<string, any>; // action, event
}

interface PageMeta {
  id: string;
  name: string;
  title?: string;
  description?: string;
  path: string;
  // layout?: "default" | "blank" | "sidebar" | "dashboard";
  // permissions?: string[];
}

export interface DataSourceNode {
  id: string;
  type: "rest" | "static";
  config: Record<string, any>; // todo: 根据 type 不同，config 的类型不同
  autoLoad?: boolean;
  polling?: {
    enabled: boolean;
    interval?: number;
  };
}

export interface ComponentNode {
  id: string;
  type: string;
  props?: Record<string, PropValue>;
  meta?: {
    scope: boolean;
    title?: string;
  };
  // events?: Record<string, ActionConfig>;
  children?: ComponentNode[];
  // condition?: Expression;
  // styles?: {
  // className?: string;
  // style?: Record<string, string>;
  // };
}

export type PropValue =
  | string
  | number
  | boolean
  | object
  | BindingValue
  | ExpressionValue;

export interface BindingValue {
  type: "binding";
  source: string;
  path?: string;
  defaultValue?: any;
}

export interface ExpressionValue {
  type: "expression";
  code: string;
}

// type ActionConfig = SingleAction | SingleAction[];

// interface SingleAction {
//   type:
//     | "setState"
//     | "callDataSource"
//     | "navigate"
//     | "showMessage"
//     | "openModal"
//     | "customCode";
//   config: any;
//   condition?: Expression;
// }
