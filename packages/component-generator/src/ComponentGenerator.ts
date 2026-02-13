import {
  CodeGenerator,
  DataSourceRegistry,
  Engine,
  NodeRegistry,
  SchemaValidator
} from "./engine/index.js";
import {
  type ComponentGeneratorCache,
  type ComponentGeneratorCacheOptions,
  computeSchemaCacheKey,
  createInMemoryCache,
} from "./cache.js";
import type { DataSourceDefinition, NodeDefinition } from "./engine/interfaces.js";
import type { PageConfig } from "./engine/JSONSchema.js";

export type ComponentGeneratorOptions = {
  nodeRegistry?: NodeRegistry;
  dataSourceRegistry?: DataSourceRegistry;
  schemaValidator?: SchemaValidator;
  cache?: boolean | ComponentGeneratorCacheOptions | ComponentGeneratorCache;
  cacheKey?: (schema: unknown) => string | null;
};

function isCache(value: unknown): value is ComponentGeneratorCache {
  if (!value || typeof value !== "object") return false;
  const candidate = value as ComponentGeneratorCache;
  return typeof candidate.get === "function" && typeof candidate.set === "function";
}

export class ComponentGenerator {
  private nodeRegistry: NodeRegistry;
  private dataSourceRegistry: DataSourceRegistry;
  private schemaValidator: SchemaValidator;
  private codeGenerator: CodeGenerator;
  private cache: ComponentGeneratorCache | null;
  private cacheKey: (schema: unknown) => string | null;
  private cacheEpoch = 0;

  constructor(options: ComponentGeneratorOptions = {}) {
    this.nodeRegistry = options.nodeRegistry ?? new NodeRegistry();
    this.dataSourceRegistry = options.dataSourceRegistry ?? new DataSourceRegistry();
    this.schemaValidator = options.schemaValidator ?? new SchemaValidator();
    this.codeGenerator = new CodeGenerator();
    this.cacheKey = options.cacheKey ?? computeSchemaCacheKey;
    if (options.cache === true) {
      this.cache = createInMemoryCache();
    } else if (isCache(options.cache)) {
      this.cache = options.cache;
    } else if (options.cache && typeof options.cache === "object") {
      this.cache = createInMemoryCache(options.cache);
    } else {
      this.cache = null;
    }
  }

  registerNode(definition: NodeDefinition): void {
    this.nodeRegistry.registerNode(definition);
    this.invalidateCache();
  }

  registerDataSource(definition: DataSourceDefinition): void {
    this.dataSourceRegistry.registerDataSource(definition);
    this.invalidateCache();
  }

  clear(): void {
    this.nodeRegistry.clear();
    this.dataSourceRegistry.clear();
    this.invalidateCache();
  }

  generatePageCode(schema: PageConfig): string {
    if (this.cache) {
      const schemaKey = this.cacheKey(schema);
      if (schemaKey) {
        const key = `${this.cacheEpoch}:${schemaKey}`;
        const cached = this.cache.get(key);
        if (cached.value != null) return cached.value;
        const engine = new Engine(this.nodeRegistry, this.schemaValidator, this.dataSourceRegistry);
        const fragments = engine.transform(schema);
        const code = this.codeGenerator.generate(fragments);
        this.cache.set(key, code);
        return code;
      }
    }
    const engine = new Engine(this.nodeRegistry, this.schemaValidator, this.dataSourceRegistry);
    const fragments = engine.transform(schema);
    return this.codeGenerator.generate(fragments);
  }

  private invalidateCache(): void {
    this.cacheEpoch += 1;
    this.cache?.clear?.();
  }
}
