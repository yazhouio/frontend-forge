import template from "@babel/template";
import {
  NodeDefinition,
  NodeDefinitionWithParseTemplate,
  ParseTemplateExpression,
  ParseTemplateImport,
} from "./interfaces";
import { JSX_TEMPLATE_OPTIONS } from "../constants";

export class NodeRegistry {
  nodes = new Map<string, NodeDefinitionWithParseTemplate>();

  registerNode(node: NodeDefinition) {
    const nodeWithParseTemplate = NodeRegistry.parseNodeDefinition(node);
    this.nodes.set(node.id, nodeWithParseTemplate);
  }

  static parseNodeDefinition(
    node: NodeDefinition
  ): NodeDefinitionWithParseTemplate {
    const imports = node.generateCode.imports.map(
      (importPath) => template.statement(importPath, JSX_TEMPLATE_OPTIONS)
    ) as ParseTemplateImport[];
    const stats = node.generateCode.stats.map((stat) => ({
      ...stat,
      template: template.statement(stat.code, JSX_TEMPLATE_OPTIONS),
    }));
    const jsx = node.generateCode.jsx
      ? (template.expression(
          node.generateCode.jsx,
          JSX_TEMPLATE_OPTIONS
        ) as ParseTemplateExpression)
      : undefined;

    return {
      ...node,
      templates: {
        imports,
        stats,
        jsx,
      },
    };
  }

  getNode = (id: string) => {
    return this.nodes.get(id);
  };

  clear = () => {
    this.nodes.clear();
  };
}
