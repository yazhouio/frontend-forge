import type { NodeDefinition } from "../nodes/interfaces";

export const getSimpleNodeDefinition = ({
  isRoot,
  id,
  type,
}: {
  isRoot: boolean;
  id: string;
  type: string;
}): NodeDefinition => {
  return {
    id,
    generateCode: (props: any, ctx: any) => {
      return {
        jsx: `<${type} ${Object.keys(props)
          .map((key) => `${key}=${props[key]}`)
          .join(" ")}> ${ctx.children} </${type}>`,
        imports: [],
        statements: [],
        meta: {
          nodeName: id,
          ...(isRoot && {
            main: true,
            renderBoundary: true,
          }),
        },
      };
    },
  };
};
