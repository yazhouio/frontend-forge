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
    imports: [],
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
