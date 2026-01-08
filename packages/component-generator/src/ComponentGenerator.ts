import {
  CodeGenerator,
  DataSourceRegistry,
  Engine,
  NodeRegistry,
  SchemaValidator
} from "./engine/index.js";
import * as defaultDataSources from "./datasources/index.js";
import * as defaultNodes from "./nodes/index.js";
import type { DataSourceDefinition, NodeDefinition } from "./engine/interfaces.js";
import type { PageConfig } from "./engine/JSONSchema.js";

export type ComponentGeneratorOptions = {
  nodeRegistry?: NodeRegistry;
  dataSourceRegistry?: DataSourceRegistry;
  schemaValidator?: SchemaValidator;
};

function isDefinition(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === "object" && "id" in value);
}

export class ComponentGenerator {
  private nodeRegistry: NodeRegistry;
  private dataSourceRegistry: DataSourceRegistry;
  private schemaValidator: SchemaValidator;
  private codeGenerator: CodeGenerator;

  constructor(options: ComponentGeneratorOptions = {}) {
    this.nodeRegistry = options.nodeRegistry ?? new NodeRegistry();
    this.dataSourceRegistry = options.dataSourceRegistry ?? new DataSourceRegistry();
    this.schemaValidator = options.schemaValidator ?? new SchemaValidator();
    this.codeGenerator = new CodeGenerator();
  }

  static withDefaults(options: ComponentGeneratorOptions = {}): ComponentGenerator {
    const generator = new ComponentGenerator(options);
    generator.loadDefaults();
    return generator;
  }

  registerNode(definition: NodeDefinition): void {
    this.nodeRegistry.registerNode(definition);
  }

  registerDataSource(definition: DataSourceDefinition): void {
    this.dataSourceRegistry.registerDataSource(definition);
  }

  clear(): void {
    this.nodeRegistry.clear();
    this.dataSourceRegistry.clear();
  }

  loadDefaults(): void {
    for (const def of Object.values(defaultNodes)) {
      if (isDefinition(def)) this.registerNode(def as NodeDefinition);
    }
    for (const def of Object.values(defaultDataSources)) {
      if (isDefinition(def)) this.registerDataSource(def as DataSourceDefinition);
    }
  }

  generatePageCode(schema: PageConfig): string {
    const engine = new Engine(this.nodeRegistry, this.schemaValidator, this.dataSourceRegistry);
    const fragments = engine.transform(schema);
    return this.codeGenerator.generate(fragments);
  }
}
