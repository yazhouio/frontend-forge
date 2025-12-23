import { HookSemantic, StatementScope } from "../engine/interfaces";
import type {
  CompileContext,
  LooseCodeFragmentIR,
  NodeDefinition,
} from "./interfaces";

export class Page implements NodeDefinition {
  id = "Page";
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragmentIR {
    const code = `<div className={"${props.name}"}>value: ${props.value}
    <div>${ctx.children}</div>
    </div>`;
    return {
      jsx: code,
      imports: [`import * as React from 'react';`],
      statements: [],
      meta: {
        depends: [],
        main: true,
        nodeName: "Page",
      },
    };
  }
}

export class Create implements NodeDefinition {
  id = "Create";
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragmentIR {
    const code = `<div className={"${props.className}"}>
      <input value={value} onChange={onChange} />
      <Button onClick={onSubmit}>Create</Button>
    </div>`;
    return {
      jsx: code,
      imports: [`import * as React from 'react';`],
      statements: [
        {
          hook: HookSemantic.State,
          scope: StatementScope.FunctionBody,
          code: `const [value, setValue] = React.useState('');`,
        },
        {
          hook: HookSemantic.None,
          scope: StatementScope.FunctionBody,
          code: `const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setValue(e.target.value);
          };`,
        },
        {
          hook: HookSemantic.None,
          scope: StatementScope.FunctionBody,
          code: `const onSubmit = () => {
            // console.log(value);
            setValue('');
          };`,
        },
      ],
      meta: {
        depends: ["Button"],
        nodeName: "Create",
        renderBoundary: true,
      },
    };
  }
}

export class Text implements NodeDefinition {
  id = "Text";
  renderBoundary = false;
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragmentIR {
    const code = `<span>${props.text}</span>`;
    return {
      jsx: code,
      imports: [`import * as React from 'react';`],
      statements: [],
      meta: {
        depends: [],
        nodeName: "Text",
        renderBoundary: false,
      },
    };
  }
}

export class Button implements NodeDefinition {
  id = "Button";
  generateCode(
    props: Record<string, any>,
    ctx: CompileContext
  ): LooseCodeFragmentIR {
    const code = `<AntdButton onClick={props.onClick}>{props.children}</AntdButton>`;
    return {
      jsx: code,
      imports: [
        `import * as React from 'react';`,
        `import { Button as AntdButton } from 'antd';`,
      ],
      statements: [],
      meta: {
        depends: [],
        nodeName: "Button",
        renderBoundary: true,
      },
    };
  }
}

export type {
  CompileContext,
  DataSourceSchema,
  LooseCodeFragmentIR,
  NodeDefinition,
  NodeSchema,
  PageSchema,
} from "./interfaces";
