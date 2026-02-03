import { CodeGenerator } from "../engine/CodeGenerator.js";
import { DataSourceRegistry } from "../engine/DataSourceRegistry.js";
import { Engine } from "../engine/Engine.js";
import { NodeRegistry } from "../engine/NodeRegistry.js";
import { SchemaValidator } from "../engine/SchemaValidator.js";
import {
  CrdColumnsDataSource,
  CrdPageStateDataSource,
  WorkspaceCrdPageStateDataSource,
} from "./dataSourceDef.js";
import { CrdTableNode } from "./nodeDef.js";
import { crdTablePageConfig } from "./crdTablePageConfig.js";
import { workspaceTablePageConfig } from "./workspaceTablePageConfig.js";

const nodeRegistry = new NodeRegistry();
nodeRegistry.registerNode(CrdTableNode);

const dataSourceRegistry = new DataSourceRegistry();
dataSourceRegistry.registerDataSource(CrdColumnsDataSource);
dataSourceRegistry.registerDataSource(CrdPageStateDataSource);
dataSourceRegistry.registerDataSource(WorkspaceCrdPageStateDataSource);

const schemaValidator = new SchemaValidator();
const engine = new Engine(nodeRegistry, schemaValidator, dataSourceRegistry);
const codeGenerator = new CodeGenerator();

const configs = [crdTablePageConfig, workspaceTablePageConfig];
configs.forEach((config) => {
  schemaValidator.validate(config, config.meta.id);
  const fragments = engine.transform(config);
  const code = codeGenerator.generate(fragments);
  console.log(`\n--- ${config.meta.name} ---`);
  console.log(code);
});
