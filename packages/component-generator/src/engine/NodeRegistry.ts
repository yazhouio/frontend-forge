import template from "@babel/template";
import { z } from "zod";
import {
  NodeDefinition,
  NodeDefinitionWithParseTemplate,
  ParseTemplateExpression,
  ParseTemplateImport,
} from "./interfaces.js";
import { JSX_TEMPLATE_OPTIONS, StatementScope } from "../constants.js";

const statementScopeValues = Object.values(StatementScope) as [
  StatementScope,
  ...StatementScope[]
];

const dataSchema: z.ZodType<any> = z.lazy(() =>
  z
    .object({
      $id: z.string().optional(),
      $schema: z.string().optional(),
      type: z.enum(["object", "array", "string", "number", "boolean"]),
      properties: z.record(dataSchema).optional(),
      items: dataSchema.optional(),
      required: z.array(z.string()).optional(),
      description: z.string().optional(),
      $path: z.array(z.string()).optional(),
    })
    .passthrough()
);

const nodeDefinitionSchema = z
  .object({
    id: z.string().min(1),
    schema: z
      .object({
        templateInputs: z.record(dataSchema).optional(),
        runtimeProps: z.record(dataSchema).optional(),
      })
      .strict(),
    generateCode: z
      .object({
        imports: z.array(z.string()),
        stats: z.array(
          z
            .object({
              id: z.string(),
              scope: z.enum(statementScopeValues),
              code: z.string(),
              output: z.array(z.string()),
              depends: z.array(z.string()),
            })
            .strict()
        ),
        jsx: z.string().optional(),
        meta: z
          .object({
            inputPaths: z.record(z.array(z.string())),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .strict();

export class NodeRegistry {
  nodes = new Map<string, NodeDefinitionWithParseTemplate>();

  registerNode(node: NodeDefinition) {
    NodeRegistry.validateNodeDefinition(node);
    const nodeWithParseTemplate = NodeRegistry.parseNodeDefinition(node);
    this.nodes.set(node.id, nodeWithParseTemplate);
  }

  static validateNodeDefinition(node: NodeDefinition) {
    const result = nodeDefinitionSchema.safeParse(node);
    if (result.success) {
      return;
    }
    const label = node?.id ? ` "${node.id}"` : "";
    const details = result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `${path} ${issue.message}`.trim();
    });
    throw new Error(
      `NodeDefinition${label} validation failed:\n${details.join("\n")}`
    );
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
