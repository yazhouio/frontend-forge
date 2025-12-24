import swc from "@swc/core";
import type { CodeFragmentIR } from "./interfaces";
import { HookSemantic } from "./interfaces";
import type {
  LooseCodeFragmentIR,
  NodeDefinition,
  NodeSchema,
  PageSchema,
} from "../nodes/interfaces";
import { CodeFragment } from "./codeFragment";
import { getSimpleNodeDefinition } from "../tools/getSimpleNodeDefinition";
import { DEFAULT_SWC_PARSE_OPTIONS } from "../tools/swcParseOptions";

export class Engine {
  nodes = new Map();
  registerNode(node: NodeDefinition): Engine {
    this.nodes.set(node.id, node);
    return this;
  }

  getNode(id: string): NodeDefinition {
    return this.nodes.get(id);
  }

  compileNode = (
    node: NodeSchema,
    looseCodeFragmentMap: Map<string, LooseCodeFragmentIR>,
    isRoot = false
  ): LooseCodeFragmentIR => {
    let nodeIR = this.getNode(node.type);
    if (!nodeIR) {
      nodeIR = getSimpleNodeDefinition({
        isRoot,
        id: node.id,
        type: node.type,
      });
    }
    const looseCodeFragment = nodeIR.generateCode(node.props, {
      children:
        node.children
          ?.map((child) => {
            const item = this.compileNode(child, looseCodeFragmentMap);
            if (item.meta?.renderBoundary) {
              return `<${item.meta?.nodeName} ${Object.keys(child.props)
                .map((key) => `${key}=${child.props[key]}`)
                .join(" ")} />`;
            }
            return item.jsx;
          })
          .join("\n") || "",
    });
    looseCodeFragmentMap.set(nodeIR.id, looseCodeFragment);
    return looseCodeFragment;
  };

  bindLooseCodeFragmentGroup = (
    node: NodeSchema,
    looseCodeFragment: LooseCodeFragmentIR
  ) => {
    // todo
  };

  mergeLooseCodeFragmentGroup = (
    looseCodeFragmentGroupA: LooseCodeFragmentIR,
    looseCodeFragmentGroupB: LooseCodeFragmentIR
  ): LooseCodeFragmentIR => {
    return {
      imports: [
        ...looseCodeFragmentGroupA?.imports,
        ...looseCodeFragmentGroupB?.imports,
      ],
      statements: [
        ...looseCodeFragmentGroupA?.statements,
        ...looseCodeFragmentGroupB?.statements,
      ],
      statementsWithMeta: [
        ...(looseCodeFragmentGroupA?.statementsWithMeta ?? []),
        ...looseCodeFragmentGroupB?.statements.flatMap((stat) => ({
          stmt: swc.parseSync(stat.code, DEFAULT_SWC_PARSE_OPTIONS).body,
          owner: looseCodeFragmentGroupB.meta?.nodeName,
          scope: stat.scope,
          hook: stat.hook,
          reorderable: stat.hook === HookSemantic.None,
        })),
      ],
      jsx: looseCodeFragmentGroupA?.jsx,
      meta: {
        ...looseCodeFragmentGroupA?.meta,
        depends: [
          ...(looseCodeFragmentGroupA?.meta?.depends ?? []),
          ...(looseCodeFragmentGroupB?.meta?.depends ?? []),
        ],
      },
    };
  };

  getCodeFragmentGroup = (
    node: NodeSchema,
    looseCodeFragmentMap: Map<string, LooseCodeFragmentIR>,
    group: Map<string, CodeFragmentIR>
  ) => {
    if (!looseCodeFragmentMap.has(node.id)) {
      throw new Error(`${node.id} 对应的 LooseCodeFragmentIR 不存在`);
    }
    const nodeIR = looseCodeFragmentMap.get(node.id)!;
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
    };
    mainIR = this.mergeLooseCodeFragmentGroup(mainIR, nodeIR);
    this.bindLooseCodeFragmentGroup(node, mainIR);

    let children = [...(node.children ?? [])];
    while (children?.length) {
      const child = children.shift()!;
      if (!looseCodeFragmentMap.has(child.id)) {
        throw new Error(`${node.id} 对应的 LooseCodeFragmentIR 不存在`);
      }
      const childNodeIR = looseCodeFragmentMap.get(child.id)!;
      if (childNodeIR?.meta?.renderBoundary) {
        nodeIR.meta.depends = [
          ...(nodeIR.meta?.depends ?? []),
          childNodeIR.meta.nodeName,
        ];
        this.getCodeFragmentGroup(child, looseCodeFragmentMap, group);
      } else {
        if (child.children?.length) {
          children = children.concat(child.children);
        }
      }
      mainIR = this.mergeLooseCodeFragmentGroup(mainIR, childNodeIR);
    }
    const codeFragment = CodeFragment.fromLooseCodeFragmentGroup(mainIR);
    group.set(nodeIR?.meta.nodeName, codeFragment);
  };

  compile(schema: PageSchema): { path: string; code: string }[] {
    const looseCodeFragmentMap = new Map();
    this.compileNode(schema.root, looseCodeFragmentMap, true);

    const group: Map<string, CodeFragmentIR> = new Map();
    this.getCodeFragmentGroup(schema.root, looseCodeFragmentMap, group);

    return Array.from(group.entries()).map(([key, codeFragment]) => {
      return {
        path: key,
        code: CodeFragment.generateCode(codeFragment),
      };
    });
  }
}

export { CodeFragment } from "./codeFragment";
export type {
  CodeFragmentIR,
  FunctionBodyIR,
  FunctionIR,
  StatementWithMeta,
} from "./interfaces";
