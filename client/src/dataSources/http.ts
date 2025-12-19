import { DataSourceDefinition } from '../interfaces';

import useSwr from 'swr';

const useUsers = () =>
  useSwr('/users', () => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve([
          { name: 'xxx', id: 1 },
          { name: 'yyy', id: 2 },
        ]);
      });
    });
  });

export const httpDataSource: DataSourceDefinition = {
  id: 'http',
  generateCode: (config: any) => {
    return {
      dependencies: ['import useSwr from "swr"'],
      statements: [
        {
          type: 'data',
          name: 'get users',
          code: `const useUsers = () =>
  useSwr('/users', () => {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve([
          { name: 'xxx', id: 1 },
          { name: 'yyy', id: 2 },
        ]);
      });
    });
  });`,
        },
      ],
    };
  },
};
