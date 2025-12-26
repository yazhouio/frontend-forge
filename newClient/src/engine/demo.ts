import { LayoutNode, TextNode } from "../nodes";
import { Engine } from "./Engine";
import { NodeRegistry } from "./NodeRegistry";
import { PageConfig } from "./JSONSchema";
import { SchemaValidator } from "./SchemaValidator";
import { CodeGenerator } from "./CodeGenerator";

const pageSchema: PageConfig = {
  meta: {
    id: "page-1",
    name: "Page 1",
    title: "Page 1",
    path: "/page-1",
  },
  context: {},
  root: {
    id: "component-1",
    type: "Layout",
    props: {
      TEXT: "Hello Layout",
    },
    meta: {
      title: "Layout",
      scope: true,
    },
    children: [
      {
        id: "component-2",
        type: "Text",
        props: {
          TEXT: "Hello Text",
          DEFAULT_VALUE: 1,
        },
        meta: {
          title: "Text",
          scope: false,
        },
      },
    ],
  },
};

const basePageSchema: PageConfig = {
  meta: {
    id: "page-1",
    name: "Page 1",
    title: "Page 1",
    path: "/page-1",
  },
  context: {},
  root: {
    id: "component-1",
    type: "Text",
    props: {
      TEXT: "Hello Text",
      DEFAULT_VALUE: 1,
    },
    meta: {
      title: "Text",
      scope: false,
    },
  },
};
const nodeRegistry = new NodeRegistry();
nodeRegistry.registerNode(TextNode);
nodeRegistry.registerNode(LayoutNode);
const schemaValidator = new SchemaValidator();
const engine = new Engine(nodeRegistry, schemaValidator);
const codeFragments = engine.transform(pageSchema);
const codeGenerator = new CodeGenerator();
console.log("codeFragments", codeFragments);
const code = codeGenerator.generate(codeFragments);
console.log(code);
