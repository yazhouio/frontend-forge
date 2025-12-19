import {
  CodeFragment,
  CompileContext,
  ConfigSchema,
  NodeDefinition,
  RuntimeContext,
} from '../interfaces';
import * as React from 'react';

class PageNodeEditor {
  icon = 'AppMysql';
  displayName = 'Page';
  preview = () => null;
  configSchema: ConfigSchema = {
    fields: [],
  };
}

export class ButtonNode implements NodeDefinition {
  id = 'Button';
  type = 'Button';
  renderBoundary = false;
  editor: PageNodeEditor;
  constructor() {
    this.editor = new PageNodeEditor();
  }
  render(props: Record<string, any>, ctx: RuntimeContext): React.ReactNode {
    return <div>todo</div>;
  }
  generateCode(props: Record<string, any>, ctx: CompileContext): CodeFragment {
    return {
      jsx: '<button onClick={handleClick}>{count}</button>',
      statements: [
        {
          type: 'hook',
          name: 'button add',
          code: 'const [count, setCount] = useState(0);',
        },
        {
          type: 'const',
          name: 'handleClick',
          code: 'const handleClick = () => { setCount(count + 1); };',
        },
      ],
      dependencies: [],
    };
  }
}
