import template from "@babel/template";
import { z } from "zod";
import {
  DataSourceDefinition,
  DataSourceDefinitionWithParseTemplate,
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

const dataSourceDefinitionSchema = z
  .object({
    id: z.string().min(1),
    schema: z
      .object({
        templateInputs: z.record(dataSchema).optional(),
        runtimeProps: z.record(dataSchema).optional(),
        outputs: z.record(dataSchema).optional(),
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

export class DataSourceRegistry {
  dataSources = new Map<string, DataSourceDefinitionWithParseTemplate>();

  registerDataSource(dataSource: DataSourceDefinition) {
    DataSourceRegistry.validateDataSourceDefinition(dataSource);
    const dataSourceWithTemplate =
      DataSourceRegistry.parseDataSourceDefinition(dataSource);
    this.dataSources.set(dataSource.id, dataSourceWithTemplate);
  }

  static validateDataSourceDefinition(dataSource: DataSourceDefinition) {
    const result = dataSourceDefinitionSchema.safeParse(dataSource);
    if (result.success) {
      return;
    }
    const label = dataSource?.id ? ` "${dataSource.id}"` : "";
    const details = result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `${path} ${issue.message}`.trim();
    });
    throw new Error(
      `DataSourceDefinition${label} validation failed:\n${details.join("\n")}`
    );
  }

  static parseDataSourceDefinition(
    dataSource: DataSourceDefinition
  ): DataSourceDefinitionWithParseTemplate {
    const imports = dataSource.generateCode.imports.map(
      (importPath) => template.statement(importPath, JSX_TEMPLATE_OPTIONS)
    ) as ParseTemplateImport[];
    const stats = dataSource.generateCode.stats.map((stat) => ({
      ...stat,
      template: template.statement(stat.code, JSX_TEMPLATE_OPTIONS),
    }));

    return {
      ...dataSource,
      templates: {
        imports,
        stats,
      },
    };
  }

  getDataSource = (id: string) => {
    return this.dataSources.get(id);
  };

  clear = () => {
    this.dataSources.clear();
  };
}
