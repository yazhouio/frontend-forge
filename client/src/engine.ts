import type { Statement, Expression, Module, Script, ExpressionStatement } from "@swc/core";
import swc, { version } from "@swc/core";
import { ImportManager } from "./import";

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
    id: "Page",
    type: "Page",
    props: { name: "page", value: 1 },
    children: [
      {
        id: "Div1",
        type: "div",
        props: { className: "'div1'" },
        children: [
          {
            id: "Create",
            type: "Create",
            props: { className: "'create'" },
          },
        ],
      },
      {
        id: "Div2",
        type: "div",
        props: { className: "'div2'" },
        children: [
          {
            id: "Text",
            type: "Text",
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
  generateCode: (
    props: Record<string, any>,
    ctx: CompileContext
  ) => LooseCodeFragmentIR;
}

interface CompileContext {
  children?: string;
}

interface LooseCodeFragmentIR {
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
  }
}

class Page implements NodeDefinition {
  id = "Page";
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragmentIR {
    const code = `<div className={"${props.name}"}>value: ${props.value}
    <div>${ctx.children}</div>
    </div>`;
    return {
      jsx: code,
      imports: [
        `import * as React from 'react';`,
      ],
      statements: [],
      meta: {
        depends: [],
        main: true,
        nodeName: "Page",
      },
    };
  }
}

class Create implements NodeDefinition {
  id = "Create";
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragmentIR {
    const code = `<div className={"${props.className}"}>
      <input value={value} onChange={onChange} />
      <Button onClick={onSubmit}>Create</Button>
    </div>`;
    return {
      jsx: code,
      imports: [
        `import * as React from 'react';`,
      ],
      statements: [
        {
          hook: HookSemantic.State,
          scope: StatementScope.FunctionBody,
          code: `const [value, setValue] = React.useState('');`,
        },
        {
          hook: HookSemantic.None,
          scope: StatementScope.FunctionBody,
          code: `const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setValue(e.target.value);
          };`,
        },
        {
          hook: HookSemantic.None,
          scope: StatementScope.FunctionBody,
          code: `const onSubmit = () => {
            console.log(value);
            setValue('');
          };`,
        },
      ],
      meta: {
        depends: ["Button"],
        nodeName: "Create",
        renderBoundary: true,
      },
    };
  }
}

class Text implements NodeDefinition {
  id = "Text";
  renderBoundary = false;
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragmentIR {
    const code = `<span>${props.text}</span>`;
    return {
      jsx: code,
      imports: [
        `import * as React from 'react';`,
      ],
      statements: [],
      meta: {
        depends: [],
        nodeName: "Text",
        renderBoundary: false,
      },
    };
  }
}
class Button implements NodeDefinition {
  id = "Button";
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragmentIR {
    const code = `<AntdButton onClick={props.onClick}>{props.children}</AntdButton>`;
    return {
      jsx: code,
      imports: [
        `import * as React from 'react';`,
        `import { Button as AntdButton } from 'antd';`,
      ],
      statements: [],
      meta: {
        depends: [],
        nodeName: "Button",
        renderBoundary: true,
      },
    };
  }
}

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

export interface FunctionIR {
  decl: StatementWithMeta; // FunctionDecl
  body: FunctionBodyIR;
  main: boolean;
}

export interface FunctionBodyIR {
  /** Hook 区（严格顺序） */
  hooks?: StatementWithMeta[];

  /** 普通语句区 */
  body?: StatementWithMeta[];

  /** return / JSX */
  returns: StatementWithMeta[];
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
      main: false,
    };
  };
}
const DUMMY = { start: 0, end: 0, ctxt: 1 };

function transformFunctionIR(functionIR: FunctionIR): Statement[] {
  const stmt = {
    ...functionIR.decl.stmt,
    body: {
      type: "BlockStatement",
      span: DUMMY,
      ctxt: 1,
      stmts: [
        ...(functionIR.body.hooks?.flatMap((hook) => hook.stmt) || []),
        ...(functionIR.body.body?.flatMap((stmt) => stmt.stmt) || []),
        ...(functionIR.body.returns?.flatMap((stmt) => stmt.stmt) || []),
      ],
    },
  };
  if (!functionIR.main) {
    return [stmt];
  }
  return [
    stmt,
    {
      type: "ExportDefaultExpression",
      span: DUMMY,
      expression: {
        ...identifier(functionIR.decl?.stmt?.identifier?.value),
      },
    },
  ];
}

class CodeFragment implements CodeFragmentIR {
  imports: ImportManager = new ImportManager();

  moduleDecls: StatementWithMeta[] = [];

  moduleInits: StatementWithMeta[] = [];

  functions: FunctionIR[] = []

  static toAst(codeFragment: CodeFragmentIR): Statement[] {
    return [
      ...(codeFragment.moduleDecls?.map((stmt) => stmt.stmt) || []),
      ...(codeFragment.moduleInits?.map((stmt) => stmt.stmt) || []),
      ...(codeFragment.functions?.flatMap((stmt) => transformFunctionIR(stmt)) || []),
    ]
  }
  static generateCode(codeFragment: CodeFragmentIR): string {
    const imports = codeFragment.imports.parse().visitor().toString();
    const body = swc.printSync(
      {
        type: "Script",
        span: DUMMY,
        body: CodeFragment.toAst(codeFragment),
      } as Script, {
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: true,
          dynamicImport: true,
        }
      }
    },
    ).code;
    return imports + "\n\n" + body;
  }

  static fromLooseCodeFragmentGroup(looseCodeFragment: LooseCodeFragmentIR): CodeFragmentIR {
    const imports = new ImportManager(looseCodeFragment.imports);
    const moduleDecls: StatementWithMeta[] = [];
    const moduleInits: StatementWithMeta[] = [];
    const functions: FunctionIR[] = [];
    const functionBodyIRs: StatementWithMeta[] = [];

    console.log('statementsWithMeta', looseCodeFragment.statementsWithMeta)
    looseCodeFragment.statementsWithMeta?.forEach((stmt) => {
      switch (stmt.scope) {
        case StatementScope.ModuleDecl:
          moduleDecls.push(stmt);
          break;
        case StatementScope.ModuleInit:
          moduleInits.push(stmt);
          break;
        case StatementScope.FunctionBody:
          functionBodyIRs.push(stmt);
          break;
      }
    })

    if (functionBodyIRs.length) {
      let functionIRBuilder = new FunctionIRBuilder();
      functionIRBuilder.setDecl(looseCodeFragment.meta.nodeName);
      functionBodyIRs.forEach((stmt) => {
        functionIRBuilder.addBody(stmt);
      })
      if (looseCodeFragment.jsx) {
        functionIRBuilder.addReturn({
          stmt: typeof looseCodeFragment.jsx === "string" ? {
            span: DUMMY,
            type: "ReturnStatement",
            argument: (swc.parseSync(looseCodeFragment.jsx, {
              syntax: "typescript",
              tsx: true,
            }).body[0] as ExpressionStatement).expression,
          } : looseCodeFragment.jsx,
          scope: StatementScope.FunctionBody,
          hook: HookSemantic.None,
          reorderable: true,
          owner: `${looseCodeFragment.meta.nodeName}Return`,
        });
      }
      functions.push(functionIRBuilder.build());
    }

    return {
      imports,
      moduleDecls,
      moduleInits,
      functions
    }
  }


}

const getSimpleNodeDefinition = ({ isRoot, id, type }: {
  isRoot: boolean,
  id: string,
  type: string
}): NodeDefinition => {

  return {
    id,
    generateCode: (props: any, ctx: any) => {
      return {
        jsx: `<${type} ${Object.keys(props)
          .map((key) => `${key}=${props[key]}`)
          .join(" ")}> ${ctx.children} </${type}>`,
        imports: [],
        statements: [],
        meta: {
          nodeName: id,
          ...(isRoot && ({
            main: true,
            renderBoundary: true
          }))
        }
      }
    }
  }
}



class Engine {
  nodes = new Map();
  registerNode(node: NodeDefinition): Engine {
    this.nodes.set(node.id, node);
    return this;
  }

  getNode(id: string): NodeDefinition {
    return this.nodes.get(id);
  }

  compileNode = (node: NodeSchema, looseCodeFragmentMap: Map<string, LooseCodeFragmentIR>, isRoot = false): LooseCodeFragmentIR => {
    let nodeIR = this.getNode(node.type);
    if (!nodeIR) {
      nodeIR = getSimpleNodeDefinition({
        isRoot,
        id: node.id,
        type: node.type
      });
    }
    let looseCodeFragment = nodeIR.generateCode(node.props, {
      children: node.children?.map((child) => {
        let item = this.compileNode(child, looseCodeFragmentMap);
        if (item.meta?.renderBoundary) {
          return `<${item.meta?.nodeName} ${Object.keys(child.props)
            .map((key) => `${key}=${child.props[key]}`)
            .join(" ")} />`
        }
        return item.jsx
      }).join("\n") || "",
    })
    looseCodeFragmentMap.set(nodeIR.id, looseCodeFragment);
    return looseCodeFragment;
  }


  bindLooseCodeFragmentGroup = (node: NodeSchema, looseCodeFragment: LooseCodeFragmentIR) => {
    // todo
  }

  mergeLooseCodeFragmentGroup = (looseCodeFragmentGroupA: LooseCodeFragmentIR, looseCodeFragmentGroupB: LooseCodeFragmentIR): LooseCodeFragmentIR => {
    return {
      imports: [
        ...looseCodeFragmentGroupA?.imports, ...looseCodeFragmentGroupB?.imports,
      ],
      statements: [
        ...looseCodeFragmentGroupA?.statements, ...looseCodeFragmentGroupB?.statements
      ],
      statementsWithMeta: [
        ...looseCodeFragmentGroupA?.statementsWithMeta ?? [], ...looseCodeFragmentGroupB?.statements.flatMap(
          stat => ({
            stmt: swc.parseSync(stat.code, {
              syntax: "typescript",
              tsx: true,
              decorators: true,
              dynamicImport: true,
            }).body,
            owner: looseCodeFragmentGroupB.meta?.nodeName,
            scope: stat.scope,
            hook: stat.hook,
            reorderable: stat.hook === HookSemantic.None,
          })
        )
      ],
      jsx: looseCodeFragmentGroupA?.jsx,
      meta: {
        ...looseCodeFragmentGroupA?.meta,
        depends: [
          ...looseCodeFragmentGroupA?.meta?.depends ?? [],
          ...looseCodeFragmentGroupB?.meta?.depends ?? [],
        ],
      },
    }
  }

  // 广度遍历，获取所有的 LooseCodeFragmentIR
  getCodeFragmentGroup = (node: NodeSchema, looseCodeFragmentMap: Map<string, LooseCodeFragmentIR>, group: Map<string, CodeFragmentIR>
  ) => {
    if (!looseCodeFragmentMap.has(node.id)) {
      throw new Error(`${node.id} 对应的 LooseCodeFragmentIR 不存在`);
    }
    let nodeIR = looseCodeFragmentMap.get(node.id)!
    let mainIR: LooseCodeFragmentIR = {
      imports: [],
      statements: [],
      jsx: nodeIR.jsx,
      meta: {
        main: true,
        depends: [],
        renderBoundary: true,
        nodeName: node.id,
      },
    }
    mainIR = this.mergeLooseCodeFragmentGroup(mainIR, nodeIR);
    this.bindLooseCodeFragmentGroup(node, mainIR);

    let children = [...node.children ?? []]
    while (children?.length) {
      let child = children.shift()!;
      if (!looseCodeFragmentMap.has(child.id)) {
        throw new Error(`${node.id} 对应的 LooseCodeFragmentIR 不存在`);
      }
      let childNodeIR = looseCodeFragmentMap.get(child.id)!
      console.log(childNodeIR.meta)
      if (childNodeIR?.meta?.renderBoundary) {
        nodeIR.meta.depends = [...nodeIR.meta?.depends ?? [], childNodeIR.meta.nodeName]
        this.getCodeFragmentGroup(child, looseCodeFragmentMap, group)
      } else {
        if (child.children?.length) {
          children = children.concat(child.children);
        }
      }
      mainIR = this.mergeLooseCodeFragmentGroup(mainIR, childNodeIR)
    }
    let codeFragment = CodeFragment.fromLooseCodeFragmentGroup(mainIR);
    group.set(nodeIR?.meta.nodeName, codeFragment);
  }


  compile(schema: PageSchema): string {
    // 1. schema to loose code fragment
    let looseCodeFragmentMap = new Map();
    this.compileNode(schema.root, looseCodeFragmentMap, true);
    console.log(looseCodeFragmentMap)

    // 2. schema to code fragment
    let group: Map<string, CodeFragmentIR> = new Map();
    this.getCodeFragmentGroup(schema.root, looseCodeFragmentMap, group);

    group.forEach((codeFragment, key) => {
      // console.log('codeFragment', codeFragment)
      console.log(key, CodeFragment.generateCode(codeFragment))
    })

    return ''


    // const jsx = this.compileNodeJSX(schema.root);
    // const builder = new FunctionIRBuilder();
    // builder.setDecl(schema.title);
    // builder.addReturn({
    //   stmt: {
    //     span: DUMMY,
    //     type: "ReturnStatement",
    //     argument: (swc.parseSync(jsx, {
    //       syntax: "typescript",
    //       tsx: true,
    //     }).body[0] as ExpressionStatement).expression,
    //   },
    //   scope: StatementScope.FunctionBody,
    //   hook: HookSemantic.None,
    //   reorderable: true,
    //   owner: "Engine",
    // });

    // const functionIR = builder.build();

    // return swc.printSync({
    //   type: "Module",
    //   span: DUMMY,
    //   body: [transformFunctionIR(functionIR)],
    // } as Module).code;
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
    return codeFragment.jsx as string || "";
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

console.log(new Engine().registerNode(new Page()).registerNode(new Button()).registerNode(new Text()).registerNode(new Create()).compile(schema));
