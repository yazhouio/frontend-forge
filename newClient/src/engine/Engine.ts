import { PublicReplacements } from "@babel/template";
import * as t from "@babel/types";
import { pick } from "es-toolkit";
import {
  CodeFragment,
  NodeDefinitionWithParseTemplate,
  Stat,
} from "./interfaces";
import { NodeRegistry } from "./NodeRegistry";
import {
  BindingValue,
  ComponentNode,
  ExpressionValue,
  PageConfig,
} from "./JSONSchema";
import { SchemaValidator } from "./SchemaValidator";

export class Engine {
  nodeRegistry: NodeRegistry;
  schemaValidator: SchemaValidator;

  constructor(nodeRegistry: NodeRegistry, schemaValidator: SchemaValidator) {
    this.nodeRegistry = nodeRegistry;
    this.schemaValidator = schemaValidator;
  }

  transform(schema: PageConfig): Map<string, CodeFragment> {
    const root = schema.root;
    const nodeFragments: Map<string, CodeFragment> = new Map();
    this.generateNodeFragments(root, nodeFragments);
    return nodeFragments;
  }

  private generateNodeFragments(
    node: ComponentNode,
    nodeFragments: Map<string, CodeFragment>
  ) {
    const nodeDef = this.nodeRegistry.getNode(node.type);
    if (!nodeDef) {
      throw new Error(`Node ${node.type} not found`);
    }
    const codeFragment = this.node2codeFragment(nodeDef, node);
    codeFragment.children = [];
    node.children?.forEach((child) => {
      this.generateNodeFragments(child, nodeFragments);
      codeFragment.children!.push(child.id);
    });
    nodeFragments.set(node.id, codeFragment);
  }

  //   private generateNodeFragment(node: ComponentNode): CodeFragment {
  //     const nodeDef = this.nodeRegistry.getNode(node.type);
  //     if (!nodeDef) {
  //       throw new Error(`Node ${node.type} not found`);
  //     }
  //     const codeFragment = this.node2codeFragment(nodeDef, node);
  //     return codeFragment;
  //   }

  private wrapperNodeProps(
    props?: ComponentNode["props"]
  ): Record<string, any> {
    if (!props) {
      return {};
    }
    const replacements: Record<string, any> = {};
    Object.entries(props).forEach(([key, value]) => {
      // type PropValue = string | number | boolean | object | Binding | Expression;
      switch (typeof value) {
        case "string":
          replacements[key] = t.stringLiteral(value);
          break;
        case "number":
          replacements[key] = t.numericLiteral(value);
          break;
        case "boolean":
          replacements[key] = t.booleanLiteral(value);
          break;
        case "object":
          //todo: support binding and expression
          // is Binding
          if ((value as BindingValue)?.type === "binding") {
            // replacements[key] = t.identifier((value as Binding).source);
          }
          if ((value as ExpressionValue)?.type === "expression") {
            // replacements[key] = t.identifier(
          }
          replacements[key] = value;
          break;
        default:
          break;
      }
    });
    return replacements;
  }

  private node2codeFragment(
    nodeDef: NodeDefinitionWithParseTemplate,
    node: ComponentNode
  ): CodeFragment {
    const props = this.wrapperNodeProps(node.props);
    const imports = nodeDef.templates.imports.flatMap((importDecl) => {
      return importDecl();
    });
    const stats: Stat[] = nodeDef.templates.stats.flatMap((stat) => {
      const inputPaths = nodeDef.generateCode.meta?.inputPaths?.[stat?.id];
      const itemProps = inputPaths ? pick(props, inputPaths) : {};
      return {
        id: `${node.id}:${stat.id}`,
        source: stat.code,
        scope: stat.scope,
        stat: stat.template(itemProps),
        meta: {
          output: stat.output,
          depends: stat.depends.map((depId) => `${node.id}:${depId}`),
        },
      };
    });
    const jsxInputPaths = nodeDef.generateCode.meta?.inputPaths?.["$jsx"] ?? [];
    let jsxProps = {};
    if (jsxInputPaths.length) {
      jsxProps = pick(props, jsxInputPaths);
    }
    const jsx = nodeDef.templates.jsx?.(jsxProps);
    return {
      imports: imports,
      stats: stats,
      jsx,
      meta: {
        id: node.id,
        title: node.meta?.title,
        __config: node,
        renderBoundary: !!node.meta?.scope,
      },
    };
  }
}
