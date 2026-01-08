import AjvModule, { ErrorObject, ValidateFunction } from "ajv";
import { ComponentNode, PageConfig } from "./JSONSchema.js";
import { NodeDefinition } from "./interfaces.js";

type AjvClass = typeof import("ajv").default;
const AjvCtor: AjvClass =
  (AjvModule as unknown as { default?: AjvClass }).default ??
  (AjvModule as unknown as AjvClass);

type DataSchemaDefinition = {
  $id?: string;
  $schema?: string;
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, DataSchemaDefinition>;
  items?: DataSchemaDefinition;
  required?: string[];
  description?: string;
  $path?: string[];
};

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

const bindingValueSchema = {
  type: "object",
  required: ["type", "source"],
  properties: {
    type: { const: "binding" },
    source: { type: "string" },
    path: { type: "string" },
    defaultValue: {},
  },
  additionalProperties: true,
} as const;

const expressionValueSchema = {
  type: "object",
  required: ["type", "code"],
  properties: {
    type: { const: "expression" },
    code: { type: "string" },
  },
  additionalProperties: true,
} as const;

const bindingExpressionGuard = {
  not: {
    properties: {
      type: { enum: ["binding", "expression"] },
    },
    required: ["type"],
  },
} as const;

export class SchemaValidator {
  private ajv: InstanceType<AjvClass>;
  private validatePageConfig: ValidateFunction<PageConfig>;
  private nodePropValidators = new WeakMap<
    NodeDefinition,
    ValidateFunction<Record<string, any>>
  >();

  constructor() {
    const ajv = new AjvCtor({
      allErrors: true,
      allowUnionTypes: true,
      strict: false,
      useDefaults: true,
      coerceTypes: false,
    });
    this.ajv = ajv;
    this.validatePageConfig = this.ajv.compile<PageConfig>(pageConfigSchema);
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

  validateNodeProps(
    nodeDef: NodeDefinition,
    props?: ComponentNode["props"],
    label?: string
  ): void {
    if (!props || !Object.keys(props).length) {
      return;
    }
    const validator = this.getNodePropsValidator(nodeDef);
    if (validator(props)) {
      return;
    }
    const details = this.formatErrors(validator.errors);
    const prefix = label
      ? `Node props validation failed for ${label}:`
      : "Node props validation failed:";
    throw new Error(`${prefix}\n${details.join("\n")}`);
  }

  private getNodePropsValidator(
    nodeDef: NodeDefinition
  ): ValidateFunction<Record<string, any>> {
    const cached = this.nodePropValidators.get(nodeDef);
    if (cached) {
      return cached;
    }
    const schema = this.buildNodePropsSchema(nodeDef);
    const validator = this.ajv.compile<Record<string, any>>(schema);
    this.nodePropValidators.set(nodeDef, validator);
    return validator;
  }

  private buildNodePropsSchema(nodeDef: NodeDefinition): Record<string, any> {
    const schema = nodeDef.schema ?? {};
    const propSchemas: Record<string, any> = {};
    const props = {
      ...(schema.templateInputs ?? {}),
      ...(schema.runtimeProps ?? {}),
    } as Record<string, DataSchemaDefinition>;
    Object.entries(props).forEach(([key, value]) => {
      propSchemas[key] = this.wrapPropSchema(value);
    });
    return {
      type: "object",
      properties: propSchemas,
      additionalProperties: false,
    };
  }

  private wrapPropSchema(schema: DataSchemaDefinition): Record<string, any> {
    const jsonSchema =
      schema.type === "object"
        ? { allOf: [this.toJsonSchema(schema), bindingExpressionGuard] }
        : this.toJsonSchema(schema);
    return {
      anyOf: [bindingValueSchema, expressionValueSchema, jsonSchema],
    };
  }

  private toJsonSchema(schema: DataSchemaDefinition): Record<string, any> {
    const jsonSchema: Record<string, any> = {
      type: schema.type,
    };
    if (schema.description) {
      jsonSchema.description = schema.description;
    }
    if (schema.required?.length) {
      jsonSchema.required = schema.required;
    }
    if (schema.properties) {
      const properties: Record<string, any> = {};
      Object.entries(schema.properties).forEach(([key, value]) => {
        properties[key] = this.toJsonSchema(value);
      });
      jsonSchema.properties = properties;
    }
    if (schema.items) {
      jsonSchema.items = this.toJsonSchema(schema.items);
    }
    return jsonSchema;
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
