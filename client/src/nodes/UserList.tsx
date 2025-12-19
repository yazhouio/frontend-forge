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

export const UserList = ({ users, loading }: { users: any[]; loading: boolean }) => {
  if (loading) {
    return <div>Loading...</div>;
  }
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
};

export class UserListNode implements NodeDefinition {
  id = 'UserList';
  type = 'UserList';
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
      statements: [],
      dependencies: [],
      jsx: `if (loading) {
    return <div>Loading...</div>;
  }
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );`,
    };
  }
}
