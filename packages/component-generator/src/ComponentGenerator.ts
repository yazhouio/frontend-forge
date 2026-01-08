import {
  CodeGenerator,
  DataSourceRegistry,
  Engine,
  NodeRegistry,
  SchemaValidator
} from "./engine/index.js";
import type { DataSourceDefinition, NodeDefinition } from "./engine/interfaces.js";
import type { PageConfig } from "./engine/JSONSchema.js";

export type ComponentGeneratorOptions = {
  nodeRegistry?: NodeRegistry;
  dataSourceRegistry?: DataSourceRegistry;
  schemaValidator?: SchemaValidator;
};

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

  generatePageCode(schema: PageConfig): string {
    const engine = new Engine(this.nodeRegistry, this.schemaValidator, this.dataSourceRegistry);
    const fragments = engine.transform(schema);
    return this.codeGenerator.generate(fragments);
  }
}
