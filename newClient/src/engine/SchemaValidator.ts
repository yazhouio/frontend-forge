import Ajv, { ErrorObject, ValidateFunction } from "ajv";
import { PageConfig } from "./JSONSchema";

const pageConfigSchema = {
  $id: "PageConfig",
  type: "object",
  required: ["meta", "root", "context"],
  properties: {
    meta: { $ref: "#/$defs/pageMeta" },
        dataSources: {
            type: "array",
            items: { $ref: "#/$defs/dataSourceNode" },
        },
        actionGraphs: {
            type: "array",
            items: { $ref: "#/$defs/actionGraphSchema" },
        },
    root: { $ref: "#/$defs/componentNode" },
    context: { type: "object", additionalProperties: true },
  },
  additionalProperties: false,
  $defs: {
    pageMeta: {
      type: "object",
      required: ["id", "name", "path"],
      properties: {
                id: { type: "string" },
                name: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                path: { type: "string" },
      },
      additionalProperties: true,
    },
    dataSourceNode: {
      type: "object",
      required: ["id", "type", "config"],
      properties: {
        id: { type: "string" },
        type: { enum: ["rest", "static"] },
        config: { type: "object", additionalProperties: true },
        autoLoad: { type: "boolean" },
        polling: {
          type: "object",
          required: ["enabled"],
          properties: {
            enabled: { type: "boolean" },
            interval: { type: "number" },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
    componentMeta: {
      type: "object",
      required: ["scope"],
      properties: {
        scope: { type: "boolean" },
        title: { type: "string" },
      },
      additionalProperties: true,
    },
    propValue: {
      oneOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "null" },
        { type: "array", items: {} },
        { $ref: "#/$defs/bindingValue" },
        { $ref: "#/$defs/expressionValue" },
        {
          type: "object",
          not: {
            required: ["type"],
          },
        },
      ],
    },
    bindingValue: {
      type: "object",
      required: ["type", "source"],
            properties: {
                type: { const: "binding" },
                source: { type: "string" },
                path: { type: "string" },
                defaultValue: {},
            },
      additionalProperties: true,
    },
    expressionValue: {
      type: "object",
      required: ["type", "code"],
            properties: {
                type: { const: "expression" },
                code: { type: "string" },
            },
      additionalProperties: true,
    },
    componentNode: {
      type: "object",
      required: ["id", "type"],
      properties: {
        id: { type: "string" },
        type: { type: "string" },
        props: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/propValue" },
        },
        meta: { $ref: "#/$defs/componentMeta" },
        children: {
          type: "array",
          items: { $ref: "#/$defs/componentNode" },
        },
      },
      additionalProperties: false,
    },
    actionGraphSchema: {
      type: "object",
      required: ["id", "context", "actions"],
      properties: {
        id: { type: "string" },
        context: { type: "object", additionalProperties: true },
        actions: {
          type: "object",
          additionalProperties: { $ref: "#/$defs/actionNode" },
        },
      },
      additionalProperties: false,
    },
    actionNode: {
      type: "object",
      required: ["on", "do"],
      properties: {
        on: { type: "string" },
        do: {
          type: "array",
          items: { $ref: "#/$defs/actionStep" },
        },
      },
      additionalProperties: false,
    },
    actionStep: {
      oneOf: [
        {
          type: "object",
                    required: ["type", "to", "value"],
                    properties: {
                        type: { const: "assign" },
            to: { type: "string" },
            value: { type: "string" },
          },
          additionalProperties: false,
        },
        {
          type: "object",
          required: ["type", "id"],
          properties: {
            type: { const: "callDataSource" },
            id: { type: "string" },
            args: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
        {
          type: "object",
          required: ["type", "path"],
          properties: {
            type: { const: "reset" },
            path: { type: "string" },
          },
          additionalProperties: false,
        },
      ],
    },
  },
} as const;

export class SchemaValidator {
    private validatePageConfig: ValidateFunction<PageConfig>;

  constructor() {
    const ajv = new Ajv({
      allErrors: true,
      allowUnionTypes: true,
      strict: false,
      useDefaults: true,
      coerceTypes: false,
    });
    this.validatePageConfig = ajv.compile<PageConfig>(pageConfigSchema);
  }

    validate(schema: PageConfig, label?: string): void {
        if (this.validatePageConfig(schema)) {
            return;
        }
        const details = this.formatErrors(this.validatePageConfig.errors);
        const prefix = label
            ? `Schema "${label}" validation failed:`
            : "Schema validation failed:";
        throw new Error(`${prefix}\n${details.join("\n")}`);
    }

    private formatErrors(errors?: ErrorObject[] | null): string[] {
        if (!errors?.length) {
            return ["Unknown validation error."];
        }
    return errors.map((error) => {
      const path = error.instancePath
        ? error.instancePath.replace(/\//g, ".")
        : "(root)";
      const message = error.message ?? "is invalid";
      const params =
        error.params && Object.keys(error.params).length
          ? ` ${JSON.stringify(error.params)}`
          : "";
      return `${path} ${message}${params}`.trim();
    });
  }
}
