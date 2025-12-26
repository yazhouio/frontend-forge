import { NodeDefinition } from "../engine/interfaces";
import template from "@babel/template";
import * as t from "@babel/types";
import { JSX_TEMPLATE_OPTIONS, StatementScope } from "../constants";

export const LayoutNode: NodeDefinition = {
  id: "Layout",
  schema: {},
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: `<div className='layout'><__ENGINE_CHILDREN__ />
    <div>{%%TEXT%%}</div></div>`,
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["TEXT"],
      },
    },
  },
};

const ast = template.expression(
  LayoutNode.generateCode.jsx!,
  JSX_TEMPLATE_OPTIONS
)({
  TEXT: t.stringLiteral("Hello World"),
});

export const TextNode: NodeDefinition = {
  id: "Text",
  schema: {
    inputs: {
      TEXT: {
        type: "string",
        description: "Text content",
      },
      DEFAULT_VALUE: {
        type: "number",
        description: "Default value",
      },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useState } from "react"',
    ],
    jsx: "<div>{%%TEXT%%}</div>",
    stats: [
      {
        id: "textState",
        scope: StatementScope.FunctionBody,
        code: "const [text, setText] = useState(%%DEFAULT_VALUE%%);",
        output: ["text", "setText"],
        depends: [],
      },
    ],
    meta: {
      inputPaths: {
        $jsx: ["TEXT"],
        textState: ["DEFAULT_VALUE"],
      },
    },
  },
};

export const CounterNode: NodeDefinition = {
  id: "Counter",
  schema: {
    inputs: {
      LABEL: {
        type: "string",
        description: "Counter label",
      },
      DEFAULT_VALUE: {
        type: "number",
        description: "Default count",
      },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useState, useMemo, useEffect } from "react"',
    ],
    jsx: "<div className='counter'><span>{%%LABEL%%}</span><strong>{countLabel}</strong></div>",
    stats: [
      {
        id: "countState",
        scope: StatementScope.FunctionBody,
        code: "const [count, setCount] = useState(%%DEFAULT_VALUE%%);",
        output: ["count", "setCount"],
        depends: [],
      },
      {
        id: "countLabelMemo",
        scope: StatementScope.FunctionBody,
        code: "const countLabel = useMemo(() => String(count), [count]);",
        output: ["countLabel"],
        depends: ["countState"],
      },
      {
        id: "logEffect",
        scope: StatementScope.FunctionBody,
        code: "useEffect(() => { console.log(countLabel); }, [countLabel]);",
        output: [],
        depends: ["countLabelMemo"],
      },
    ],
    meta: {
      inputPaths: {
        $jsx: ["LABEL"],
        countState: ["DEFAULT_VALUE"],
      },
    },
  },
};

export const ToggleNode: NodeDefinition = {
  id: "Toggle",
  schema: {
    inputs: {
      LABEL: {
        type: "string",
        description: "Toggle label",
      },
    },
  },
  generateCode: {
    imports: [
      'import * as React from "react"',
      'import { useState, useCallback } from "react"',
    ],
    jsx: "<button className='toggle' onClick={toggle}>{%%LABEL%%}: {on ? 'On' : 'Off'}</button>",
    stats: [
      {
        id: "toggleState",
        scope: StatementScope.FunctionBody,
        code: "const [on, setOn] = useState(false);",
        output: ["on", "setOn"],
        depends: [],
      },
      {
        id: "toggleCallback",
        scope: StatementScope.FunctionBody,
        code: "const toggle = useCallback(() => setOn((prev) => !prev), []);",
        output: ["toggle"],
        depends: ["toggleState"],
      },
    ],
    meta: {
      inputPaths: {
        $jsx: ["LABEL"],
      },
    },
  },
};

export const ButtonNode: NodeDefinition = {
  id: "Button",
  schema: {
    inputs: {
      TEXT: {
        type: "string",
        description: "Button label",
      },
      VARIANT: {
        type: "string",
        description: "Button className",
      },
      DISABLED: {
        type: "boolean",
        description: "Disable state",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: "<button className={%%VARIANT%%} disabled={%%DISABLED%%}>{%%TEXT%%}</button>",
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["TEXT", "VARIANT", "DISABLED"],
      },
    },
  },
};

export const ImageNode: NodeDefinition = {
  id: "Image",
  schema: {
    inputs: {
      SRC: {
        type: "string",
        description: "Image source",
      },
      ALT: {
        type: "string",
        description: "Alt text",
      },
      WIDTH: {
        type: "number",
        description: "Width",
      },
      HEIGHT: {
        type: "number",
        description: "Height",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: "<img src={%%SRC%%} alt={%%ALT%%} width={%%WIDTH%%} height={%%HEIGHT%%} />",
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["SRC", "ALT", "WIDTH", "HEIGHT"],
      },
    },
  },
};

export const CardNode: NodeDefinition = {
  id: "Card",
  schema: {
    inputs: {
      TITLE: {
        type: "string",
        description: "Card title",
      },
      SUBTITLE: {
        type: "string",
        description: "Card subtitle",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: `<section className='card'>
  <header>
    <h3>{%%TITLE%%}</h3>
    <p>{%%SUBTITLE%%}</p>
  </header>
  <div className='card-body'><__ENGINE_CHILDREN__ /></div>
</section>`,
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["TITLE", "SUBTITLE"],
      },
    },
  },
};

export const SectionNode: NodeDefinition = {
  id: "Section",
  schema: {
    inputs: {
      TITLE: {
        type: "string",
        description: "Section title",
      },
      CLASSNAME: {
        type: "string",
        description: "Section className",
      },
    },
  },
  generateCode: {
    imports: ['import * as React from "react"'],
    jsx: "<section className={%%CLASSNAME%%}><h2>{%%TITLE%%}</h2><__ENGINE_CHILDREN__ /></section>",
    stats: [],
    meta: {
      inputPaths: {
        $jsx: ["TITLE", "CLASSNAME"],
      },
    },
  },
};
