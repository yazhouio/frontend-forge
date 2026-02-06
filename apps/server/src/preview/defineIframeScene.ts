import type { PageConfig } from "@frontend-forge/forge-core/advanced";

export type IframeSceneConfig = {
  meta: {
    id: string;
    name: string;
    title?: string;
    path: string;
  };
  frameUrl: string;
};

export const defineIframeScene = (scene: IframeSceneConfig): PageConfig => {
  return {
    meta: {
      id: scene.meta.id,
      name: scene.meta.name,
      title: scene.meta.title,
      path: scene.meta.path,
    },
    context: {},
    root: {
      id: `${scene.meta.id}-root`,
      type: "Iframe",
      props: {
        FRAME_URL: scene.frameUrl,
      },
      meta: {
        title: "Iframe",
        scope: true,
      },
    },
  };
};
