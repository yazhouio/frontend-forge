import type { Statement, Expression, Module, Script, ExpressionStatement } from "@swc/core";
import swc from "@swc/core";

export type StatementKind =
  | "state" // useState/useRef/const state
  | "derived" // derived values / memo
  | "handler" // event handlers / callbacks
  | "effect" // useEffect/subscription
  | "logic" // if/switch/for/try etc.
  | "other";

const schema = {
  version: "1.0",
  // dataSources: [
  //   {
  //     id: "users",
  //     type: "http",
  //     config: {
  //       url: "/api/users",
  //     },
  //   },
  // ],
  root: {
    id: "page",
    type: "Page",
    title: "Page",
    props: { name: "page", value: 1 },
    children: [
      {
        id: "div1",
        type: "div",
        props: { className: "div1" },
        children: [
          {
            id: "button",
            type: "button",
            props: { label: "button1" },
            children: [],
          },
        ],
      },
      {
        id: "div2",
        type: "div",
        props: { className: "div2" },
        children: [
          {
            id: "text",
            type: "text",
            props: { text: "text1" },
          },
        ],
      },
    ],
  },
};

type DataSourceSchema = any;
type NodeSchema = {
  id: string;
  type: string;
  props: Record<string, any>;
  children?: NodeSchema[];
};
interface PageSchema {
  version: string;
  dataSources?: DataSourceSchema[];
  root: NodeSchema;
}

interface NodeDefinition {
  id: string;
  renderBoundary: boolean;
  generateCode: (
    props: Record<string, any>,
    ctx: CompileContext
  ) => LooseCodeFragment;
}

interface CompileContext {
  children?: string;
}

interface LooseCodeFragment {
  dependencies: string[];
  statements: {
    kind: StatementKind;
    code: string;
  }[];
  jsx?: string;
}

class Page implements NodeDefinition {
  id = "Page";
  renderBoundary = true;
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragment {
    const code = `<div className="${props.name}">value: ${props.value}
    <div>${ctx.children}</div>
    </div>`;
    return {
      jsx: code,
      dependencies: [],
      statements: [],
    };
  }
}

/**
 * import * as React from 'react'; // scope:
 * import useSwr from 'swr'; // scope:
 * const useUsers = useSwr('/api/users', () => ([1,2,3])); // scope:
 * const App = () => {
 *   const users = useUsers();  // scope:
 *   return <div>{users.join(',')}</div>; // scope: body
 * }; // scope: function
 */

enum StatementScope {
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
};

enum HookSemantic {
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
};

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

export interface CodeFragment {
  /** 模块级 import */
  imports: StatementWithMeta[];

  /** 模块级声明（无副作用） */
  moduleDecls: StatementWithMeta[];

  /** 模块初始化（有副作用） */
  moduleInits: StatementWithMeta[];

  /** 函数声明（React Component / helper） */
  functions: StatementWithMeta[];

  /** JSX（通常只来自 root component） */
  jsx?: any;
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
}

function identifier(name: string) {
  return {
    type: "Identifier",
    value: name,
    span: DUMMY,
    ctxt: 1,
  };
}

class FunctionIRBuilder {
  decl?: StatementWithMeta; // FunctionDecl
  body?: FunctionBodyIR;

  constructor() {
    this.initBody();
  }

  setDecl = (name: string) => {
    this.decl = {
      stmt: {
        type: "FunctionDeclaration",
        identifier: identifier(name),
        params: [
          {
            type: "Parameter",
            pat: {
              ...identifier("props"),
            },
            span: DUMMY,
            ctxt: 1,
          },
        ],
        span: DUMMY,
        ctxt: 1,
      },
      scope: StatementScope.FunctionDecl,
      hook: HookSemantic.None,
      reorderable: true,
      owner: "FunctionIRBuilder",
    };
  };

  initBody = () => {
    this.body = {
      hooks: [],
      body: [],
      returns: [],
    };
  };

  addHook = (hook: StatementWithMeta) => {
    this.body?.hooks?.push(hook);
  };

  addBody = (stmt: StatementWithMeta) => {
    this.body?.body?.push(stmt);
  };

  addReturn = (stmt: StatementWithMeta) => {
    this.body?.returns?.push(stmt);
  };

  build = (): FunctionIR => {
    if (!this.decl || !this.body) {
      throw new Error("FunctionIRBuilder: decl or body is not set");
    }
    return {
      decl: this.decl,
      body: this.body,
    };
  };
}
const DUMMY = { start: 0, end: 0, ctxt: 1 };

function transformFunctionIR(functionIR: FunctionIR): Statement {
  return {
    ...functionIR.decl.stmt,
    body: {
      type: "BlockStatement",
      span: DUMMY,
      ctxt: 1,
      stmts: [
        ...(functionIR.body.hooks?.map((hook) => hook.stmt) || []),
        ...(functionIR.body.body?.map((stmt) => stmt.stmt) || []),
        ...(functionIR.body.returns?.map((stmt) => stmt.stmt) || []),
      ],
    },
  };
}

class Engine {
  nodes = new Map();
  compile(schema: PageSchema): string {
    const jsx = this.compileNodeJSX(schema.root);
    console.log(
      'jsx', jsx
    )
    const builder = new FunctionIRBuilder();
    builder.setDecl("App");
    builder.addReturn({
      stmt: {
        span: DUMMY,
        type: "ReturnStatement",
        argument: (swc.parseSync(jsx, {
          syntax: "typescript",
          tsx: true,
        }).body[0] as ExpressionStatement).expression,
      },
      scope: StatementScope.FunctionBody,
      hook: HookSemantic.None,
      reorderable: true,
      owner: "Engine",
    });

    const functionIR = builder.build();
    console.log(JSON.stringify({
      type: "Module",
      span: DUMMY,
      body: [transformFunctionIR(functionIR)],
    }, null, 2));
    return swc.printSync({
      type: "Module",
      span: DUMMY,
      body: [transformFunctionIR(functionIR)],
    } as Module).code;
  }

  registerNode(node: NodeDefinition): Engine {
    this.nodes.set(node.id, node);
    return this;
  }

  getNode(id: string): NodeDefinition {
    return this.nodes.get(id);
  }

  compileSimpleNodeJSX(node: NodeSchema): string {
    let nodeJSX = "";
    if (!node.children?.length) {
      nodeJSX = `<${node.type} ${Object.keys(node.props)
        .map((key) => `${key}="${node.props[key]}"`)
        .join(" ")}/>`;
    } else {
      const nodeJSXPrev = `<${node.type} ${Object.keys(node.props)
        .map((key) => `${key}="${node.props[key]}"`)
        .join(" ")}>`;
      const nodeJSXChildren = node.children
        ? node.children.map((child) => this.compileNodeJSX(child)).join("")
        : "";
      const nodeJSXNext = `</${node.type}>`;
      nodeJSX = nodeJSXPrev + nodeJSXChildren + nodeJSXNext;
    }
    return nodeJSX;
  }

  generateCode(node: NodeSchema): string {
    let nodeDefinition = this.getNode(node.type);
    if (!nodeDefinition) {
      throw new Error(`Node ${node.type} not found`);
    }
    let childrenCtx: string[] = [];
    if (node.children?.length) {
      childrenCtx = node.children.map((child) => this.compileNodeJSX(child));
    }
    const codeFragment = nodeDefinition.generateCode(node.props, {
      children: childrenCtx.join(""),
    });
    return codeFragment.jsx || "";
  }

  compileNodeJSX(node: NodeSchema): string {
    if (node.type === "text") {
      return node.props.text;
    }
    if (!this.nodes.has(node.type)) {
      return this.compileSimpleNodeJSX(node);
    }

    return this.generateCode(node);
  }
}

console.log(new Engine().registerNode(new Page()).compile(schema));
