import {
  ButtonNode,
  CounterNode,
  CardNode,
  ImageNode,
  InputNode,
  LayoutNode,
  ScopedNode,
  SectionNode,
  TableNode,
  ToggleNode,
  TextNode,
} from "../nodes/index.js";
import { Engine } from "./Engine.js";
import { DataSourceRegistry } from "./DataSourceRegistry.js";
import { NodeRegistry } from "./NodeRegistry.js";
import { NodeDefinition } from "./interfaces.js";
import { PageConfig } from "./JSONSchema.js";
import { SchemaValidator } from "./SchemaValidator.js";
import { CodeGenerator } from "./CodeGenerator.js";
import { RestDataSource, StaticDataSource } from "../datasources/index.js";

const PropCardNode: NodeDefinition = {
  id: "PropCard",
  schema: {
    runtimeProps: {
      TITLE: {
        type: "string",
        description: "Card title",
      },
      SUBTITLE: {
        type: "string",
        description: "Card subtitle",
      },
      COUNT: {
        type: "number",
        description: "Card count",
      },
      NAME: {
        type: "string",
        description: "Card name",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: "<article className='prop-card'><header><h3>{props.TITLE}</h3><p>{props.SUBTITLE}</p></header><strong>{props.COUNT ?? (props.NAME ? 1 : 0)}</strong><div className='prop-body'><__ENGINE_CHILDREN__ /></div></article>",
    stats: [],
  },
};

const pageSchemaLayout: PageConfig = {
  meta: {
    id: "page-layout",
    name: "Page Layout",
    title: "Page Layout",
    path: "/page-layout",
  },
  context: {},
  dataSources: [
    {
      id: "user-list",
      type: "rest",
      config: {
        URL: "/api/users",
        DEFAULT_VALUE: [],
        HOOK_NAME: "useUsers",
        FETCHER_NAME: "fetchUsers",
      },
      autoLoad: true,
    },
    {
      id: "posts",
      type: "rest",
      config: {
        URL: "/api/posts",
        DEFAULT_VALUE: [],
      },
      autoLoad: true,
    },
  ],
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
          scope: false,
        },
        children: [
          {
            id: "text-1",
            type: "Text",
            props: {
              TEXT: {
                type: "binding",
                source: "user-list",
                path: "data.0",
                defaultValue: "No users yet",
              },
              DEFAULT_VALUE: 1,
            },
            meta: {
              title: "Text",
              scope: false,
            },
          },
          {
            id: "text-6",
            type: "Text",
            props: {
              TEXT: {
                type: "binding",
                source: "posts",
                path: "data.0.title",
                defaultValue: "No posts yet",
              },
              DEFAULT_VALUE: 6,
            },
            meta: {
              title: "Text",
              scope: false,
            },
          },
          {
            id: "text-7",
            type: "Text",
            props: {
              TEXT: {
                type: "binding",
                source: "posts",
                path: "isLoading",
                defaultValue: false,
              },
              DEFAULT_VALUE: 7,
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
          {
            id: "table-1",
            type: "Table",
            props: {
              URL: "/api/users",
              PAGE_SIZE: 10,
              QUERY_PLACEHOLDER: "Search users",
              DATA: {
                type: "binding",
                source: "user-list",
                path: "data",
                defaultValue: [],
              },
              IS_LOADING: {
                type: "binding",
                source: "user-list",
                path: "isLoading",
                defaultValue: false,
              },
              ERROR: {
                type: "binding",
                source: "user-list",
                path: "error",
                defaultValue: null,
              },
              MUTATE: {
                type: "binding",
                source: "user-list",
                path: "mutate",
              },
              COLUMNS: [
                {
                  key: "name",
                  title: "Name",
                  mapper: {
                    type: "expression",
                    code: '(value) => (value ? String(value).toUpperCase() : "-")',
                  },
                },
                {
                  key: "email",
                  title: "Email",
                },
                {
                  key: "role",
                  title: "Role",
                  mapper: {
                    type: "expression",
                    code: "(value, row) => (row.active ? `${value} (active)` : value)",
                  },
                },
              ],
            },
            meta: {
              title: "Table",
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

const pageSchemaProps: PageConfig = {
  meta: {
    id: "page-props",
    name: "Page Props",
    title: "Page Props",
    path: "/page-props",
  },
  context: {},
  root: {
    id: "layout-props",
    type: "Layout",
    props: {
      TEXT: "Props Layout",
    },
    meta: {
      title: "Layout",
      scope: true,
    },
    children: [
      {
        id: "toggle-prop-1",
        type: "Toggle",
        props: {
          LABEL: "Prop state",
        },
        meta: {
          title: "Toggle",
          scope: false,
        },
      },
      {
        id: "prop-card-1",
        type: "PropCard",
        props: {
          TITLE: 'State On',
          SUBTITLE: "Passed via state",
          COUNT: {
            type: "expression",
            code: "on ? 1 : 0",
          },
        },
        meta: {
          title: "PropCard",
          scope: true,
        },
        children: [
          {
            id: "text-prop-1",
            type: "Text",
            props: {
              TEXT: "Child inside prop card",
              DEFAULT_VALUE: 9,
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

const pageSchemaScoped: PageConfig = {
  meta: {
    id: "page-scoped",
    name: "Page Scoped",
    title: "Page Scoped",
    path: "/page-scoped",
  },
  context: {},
  root: {
    id: "layout-scoped",
    type: "Layout",
    props: {
      TEXT: "Scoped Layout",
    },
    meta: {
      title: "Layout",
      scope: true,
    },
    children: [
      {
        id: "scoped-1",
        type: "Scoped",
        props: {
          LABEL: "Alpha",
        },
        meta: {
          title: "Scoped",
          scope: false,
        },
      },
      {
        id: "scoped-2",
        type: "Scoped",
        props: {
          LABEL: "Beta",
        },
        meta: {
          title: "Scoped",
          scope: false,
        },
      },
    ],
  },
};

const pageSchemaActionGraph: PageConfig = {
  meta: {
    id: "page-action-graph",
    name: "Page Action Graph",
    title: "Page Action Graph",
    path: "/page-action-graph",
  },
  context: {},
  dataSources: [
    {
      id: "create-user",
      type: "rest",
      config: {
        URL: "/api/users",
        METHOD: "POST",
        DEFAULT_VALUE: null,
      },
      autoLoad: false,
    },
  ],
  actionGraphs: [
    {
      id: "createUserGraph",
      context: {
        name: "",
      },
      actions: {
        INPUT_CHANGE: {
          on: "input-name.change",
          do: [
            {
              type: "assign",
              to: "context.name",
              value: "$event.value",
            },
          ],
        },
        SUBMIT: {
          on: "button-submit.click",
          do: [
            {
              type: "callDataSource",
              id: "create-user",
              args: ["context.name"],
            },
            {
              type: "reset",
              path: "context.name",
            },
          ],
        },
      },
    },
  ],
  root: {
    id: "layout-action",
    type: "Layout",
    props: {
      TEXT: "Action Graph",
    },
    meta: {
      title: "Layout",
      scope: true,
    },
    children: [
      {
        id: "input-name",
        type: "Input",
        props: {
          VALUE: {
            type: "binding",
            source: "createUserGraph",
            path: "context.name",
            defaultValue: "",
          },
          PLACEHOLDER: "Enter name",
        },
        meta: {
          title: "Input",
          scope: false,
        },
      },
      {
        id: "prop-card-action-1",
        type: "PropCard",
        props: {
          TITLE: {
            type: "binding",
            source: "createUserGraph",
            path: "context.name",
            defaultValue: "Anonymous",
          },
          SUBTITLE: "Passed via context",
          NAME: {
            type: "binding",
            source: "createUserGraph",
            path: "context.name",
            defaultValue: "",
          },
        },
        meta: {
          title: "PropCard",
          scope: true,
        },
        children: [
          {
            id: "text-action-1",
            type: "Text",
            props: {
              TEXT: "Action graph child",
              DEFAULT_VALUE: 10,
            },
            meta: {
              title: "Text",
              scope: false,
            },
          },
        ],
      },
      {
        id: "button-submit",
        type: "Button",
        props: {
          TEXT: "Add User",
          VARIANT: "btn-primary",
          DISABLED: false,
        },
        meta: {
          title: "Button",
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
nodeRegistry.registerNode(ScopedNode);
nodeRegistry.registerNode(ButtonNode);
nodeRegistry.registerNode(InputNode);
nodeRegistry.registerNode(ImageNode);
nodeRegistry.registerNode(CardNode);
nodeRegistry.registerNode(SectionNode);
nodeRegistry.registerNode(TableNode);
nodeRegistry.registerNode(PropCardNode);
const dataSourceRegistry = new DataSourceRegistry();
dataSourceRegistry.registerDataSource(StaticDataSource);
dataSourceRegistry.registerDataSource(RestDataSource);
const schemaValidator = new SchemaValidator();
const engine = new Engine(nodeRegistry, schemaValidator, dataSourceRegistry);
const codeGenerator = new CodeGenerator();

const pageSchemas = [
  pageSchemaLayout,
  pageSchemaSection,
  pageSchemaProps,
  pageSchemaMixed,
  pageSchemaHooks,
  pageSchemaScoped,
  pageSchemaActionGraph,
];
pageSchemas.forEach((schema) => {
  schemaValidator.validate(schema, schema.meta.id);
  const codeFragments = engine.transform(schema);
  // console.log("codeFragments", schema.meta.id, codeFragments);
  const code = codeGenerator.generate(codeFragments);
  console.log(`\n--- ${schema.meta.name} ---`);
  console.log(code);
});
