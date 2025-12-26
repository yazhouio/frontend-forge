import {
  ButtonNode,
  CounterNode,
  CardNode,
  ImageNode,
  LayoutNode,
  SectionNode,
  ToggleNode,
  TextNode,
} from "../nodes";
import { Engine } from "./Engine";
import { NodeRegistry } from "./NodeRegistry";
import { PageConfig } from "./JSONSchema";
import { SchemaValidator } from "./SchemaValidator";
import { CodeGenerator } from "./CodeGenerator";

const pageSchemaLayout: PageConfig = {
  meta: {
    id: "page-layout",
    name: "Page Layout",
    title: "Page Layout",
    path: "/page-layout",
  },
  context: {},
  root: {
    id: "layout-1",
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
        id: "card-1",
        type: "Card",
        props: {
          TITLE: "Welcome",
          SUBTITLE: "Layout + Card",
        },
        meta: {
          title: "Card",
          scope: true,
        },
        children: [
          {
            id: "text-1",
            type: "Text",
            props: {
              TEXT: "Card body text",
              DEFAULT_VALUE: 1,
            },
            meta: {
              title: "Text",
              scope: false,
            },
          },
          {
            id: "button-1",
            type: "Button",
            props: {
              TEXT: "Primary Action",
              VARIANT: "btn-primary",
              DISABLED: false,
            },
            meta: {
              title: "Button",
              scope: false,
            },
          },
          {
            id: "image-1",
            type: "Image",
            props: {
              SRC: "/assets/hero.png",
              ALT: "Hero image",
              WIDTH: 320,
              HEIGHT: 200,
            },
            meta: {
              title: "Image",
              scope: false,
            },
          },
        ],
      },
    ],
  },
};

const pageSchemaSection: PageConfig = {
  meta: {
    id: "page-section",
    name: "Page Section",
    title: "Page Section",
    path: "/page-section",
  },
  context: {},
  root: {
    id: "section-1",
    type: "Section",
    props: {
      TITLE: "Hero Section",
      CLASSNAME: "section hero",
    },
    meta: {
      title: "Section",
      scope: true,
    },
    children: [
      {
        id: "layout-2",
        type: "Layout",
        props: {
          TEXT: "Nested layout",
        },
        meta: {
          title: "Layout",
          scope: true,
        },
        children: [
          {
            id: "text-2",
            type: "Text",
            props: {
              TEXT: "Section body text",
              DEFAULT_VALUE: 2,
            },
            meta: {
              title: "Text",
              scope: false,
            },
          },
          {
            id: "button-2",
            type: "Button",
            props: {
              TEXT: "Secondary",
              VARIANT: "btn-secondary",
              DISABLED: false,
            },
            meta: {
              title: "Button",
              scope: false,
            },
          },
        ],
      },
    ],
  },
};

const pageSchemaMixed: PageConfig = {
  meta: {
    id: "page-mixed",
    name: "Page Mixed",
    title: "Page Mixed",
    path: "/page-mixed",
  },
  context: {},
  root: {
    id: "card-2",
    type: "Card",
    props: {
      TITLE: "Gallery",
      SUBTITLE: "Mixed content",
    },
    meta: {
      title: "Card",
      scope: true,
    },
    children: [
      {
        id: "section-2",
        type: "Section",
        props: {
          TITLE: "Highlights",
          CLASSNAME: "section highlights",
        },
        meta: {
          title: "Section",
          scope: true,
        },
        children: [
          {
            id: "image-2",
            type: "Image",
            props: {
              SRC: "/assets/feature.png",
              ALT: "Feature",
              WIDTH: 240,
              HEIGHT: 160,
            },
            meta: {
              title: "Image",
              scope: false,
            },
          },
          {
            id: "text-3",
            type: "Text",
            props: {
              TEXT: "Feature description",
              DEFAULT_VALUE: 3,
            },
            meta: {
              title: "Text",
              scope: false,
            },
          },
        ],
      },
    ],
  },
};

const pageSchemaHooks: PageConfig = {
  meta: {
    id: "page-hooks",
    name: "Page Hooks",
    title: "Page Hooks",
    path: "/page-hooks",
  },
  context: {},
  root: {
    id: "layout-hooks",
    type: "Layout",
    props: {
      TEXT: "Hook Layout",
    },
    meta: {
      title: "Layout",
      scope: true,
    },
    children: [
      {
        id: "counter-1",
        type: "Counter",
        props: {
          LABEL: "Count A",
          DEFAULT_VALUE: 1,
        },
        meta: {
          title: "Counter",
          scope: false,
        },
      },
      {
        id: "counter-2",
        type: "Counter",
        props: {
          LABEL: "Count B",
          DEFAULT_VALUE: 10,
        },
        meta: {
          title: "Counter",
          scope: false,
        },
      },
      {
        id: "toggle-1",
        type: "Toggle",
        props: {
          LABEL: "Active",
        },
        meta: {
          title: "Toggle",
          scope: false,
        },
      },
      {
        id: "text-4",
        type: "Text",
        props: {
          TEXT: "Hooked text",
          DEFAULT_VALUE: 4,
        },
        meta: {
          title: "Text",
          scope: false,
        },
      },
      {
        id: "text-5",
        type: "Text",
        props: {
          TEXT: "Another text",
          DEFAULT_VALUE: 5,
        },
        meta: {
          title: "Text",
          scope: false,
        },
      },
    ],
  },
};
const nodeRegistry = new NodeRegistry();
nodeRegistry.registerNode(TextNode);
nodeRegistry.registerNode(LayoutNode);
nodeRegistry.registerNode(CounterNode);
nodeRegistry.registerNode(ToggleNode);
nodeRegistry.registerNode(ButtonNode);
nodeRegistry.registerNode(ImageNode);
nodeRegistry.registerNode(CardNode);
nodeRegistry.registerNode(SectionNode);
const schemaValidator = new SchemaValidator();
const engine = new Engine(nodeRegistry, schemaValidator);
const codeGenerator = new CodeGenerator();

const pageSchemas = [
  pageSchemaLayout,
  pageSchemaSection,
  pageSchemaMixed,
  pageSchemaHooks,
];
pageSchemas.forEach((schema) => {
  const codeFragments = engine.transform(schema);
  console.log("codeFragments", schema.meta.id, codeFragments);
  const code = codeGenerator.generate(codeFragments);
  console.log(`\n--- ${schema.meta.name} ---`);
  console.log(code);
});
