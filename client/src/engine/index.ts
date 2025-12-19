import {
  Engine,
  PageSchema,
  CodeFragment,
  CompileContext,
  CodeFragmentMeta,
  StatementWithMeta,
  NodeSchema,
  DataSourceSchema,
} from "../interfaces";
import { ImportManager } from "./codeFragment/import";

import swc, { Statement } from "@swc/core";
export type StatementKind =
  | "definition"
  | "state"
  | "derived"
  | "handler"
  | "effect"
  | "logic"
  | "other";

interface LooseCodeFragment {
  dependencies: string[];
  statements: {
    kind: StatementKind;
    code: string;
  }[];
  jsx?: string;
  meta?: CodeFragmentMeta;
}

class Page {
  id = "Page";
  renderBoundary = true;
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragment {
    return {
      dependencies: [],
      statements: [],
      jsx: `<div className='page'>${ctx.children}</div>`,
    };
  }
}

class Button {
  id = "Button";
  renderBoundary = false;

  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragment {
    return {
      dependencies: ['import { useState } from "react";'],
      statements: [
        {
          kind: "state",
          code: "const [count, setCount] = useState(0);",
        },
        {
          kind: "handler",
          code: "const handleClick = (c) => c + 1",
        },
      ],
      jsx: "<button onClick={handleClick}>button {count}</button>",
    };
  }
}

type Definition = {
  id: string;
  renderBoundary?: boolean;
  generateCode: (config: any) => LooseCodeFragment;
};

class SwrDataSource implements Definition {
  id = "swr";
  generateCode(config: Record<string, any>): LooseCodeFragment {
    return {
      dependencies: ['import swr from "swr"'],
      statements: [
        {
          kind: "other",
          code: `
          const useUsers = () => {
            return useSWR(${config.url}, () => ([
            {name: 'xx', id:1},
            {name: 'yy', id:2},
            ]));
          }
        `,
        },
      ],
      meta: {
        scope: "module",
        source: config.schemaId,
      },
    };
  }
}

type NodeDefinition = {
  readonly id: string;
  renderBoundary: boolean;
  generateCode: (props: Record<string, any>) => CodeFragment;
};

export class FrontendForgeEngine {
  nodes: Map<string, Definition> = new Map();
  dataSources: Map<string, Definition> = new Map();

  registerNode(node: NodeDefinition) {
    const item = {};
  }

  getNode(id: string) {
    return this.nodes.get(id);
  }

  registerDataSource(dataSource: Definition): void {
    this.dataSources.set(dataSource.id, dataSource);
  }

  getDataSource(id: string) {
    return this.dataSources.get(id);
  }

  render(schema: PageSchema): void {
    // todo
  }

  compile(schema: PageSchema): string {
    return "";
  }

  bindComponentProps(node: NodeSchema) {
    const { type, props, dataSourceId } = node;
    if (!this.getNode(type)) {
      return `<${type} ${Object.keys(props)
        .map((key) => `${key}="[${dataSourceId}.${key}]"`)
        .join(" ")}/>`;
    }
  }

  looseCodeFragmentBuilder = (node: Definition, ctx: CompileContext) => {
    return (config: Record<string, any>): CodeFragment => {
      const nodeCodeFragment = node.generateCode(config);
      return {
        imports: new ImportManager(
          nodeCodeFragment.dependencies.join("\n")
        ).visitor().imports,
        statements: nodeCodeFragment.statements.map((stat) => {
          return {
            kind: stat.kind,
            node: swc.parseSync(stat.code).body,
          } as StatementWithMeta;
        }),
        jsx: nodeCodeFragment.jsx,
        meta: nodeCodeFragment.meta,
      };
    };
  };

  generateCodeFragment(schema: NodeSchema): CodeFragment[] {
    const walk = (
      root: NodeSchema,
      codeFragments: CodeFragment[],
      ctx: CompileContext
    ) => {
      const node = this.getNode(root.type);
      if (!node) {
        throw new Error(`Node ${schema.type} not found`);
      }
      codeFragments.push(this.looseCodeFragmentBuilder(node, ctx)(root.props));
      root.children.forEach((child) => {
        walk(child, codeFragments, ctx);
      });
    };
    const codeFragments: CodeFragment[] = [];
    walk(schema, codeFragments, {});
    return codeFragments;
  }

  // generateDataSourceCodeFragment(schema: DataSourceSchema[]): CodeFragment[] {}
}
