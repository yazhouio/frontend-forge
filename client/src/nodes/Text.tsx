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

export class PageNode implements NodeDefinition {
  id = 'Page';
  type = 'Page';
  renderBoundary = false;
  editor: PageNodeEditor;
  constructor() {
    this.editor = new PageNodeEditor();
  }
  render(props: Record<string, any>, ctx: RuntimeContext): React.ReactNode {
    return <div>page</div>;
  }
  generateCode(props: Record<string, any>, ctx: CompileContext): CodeFragment {
    return {
      jsx: '<div className="text">{props.text}</div>',
      statements: [],
      dependencies: [],
    };
  }
}
