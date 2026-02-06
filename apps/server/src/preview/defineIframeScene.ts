import type { PageConfig } from "@frontend-forge/forge-core/advanced";

export type IframeSceneConfig = {
  meta: {
    id: string;
    name: string;
    title?: string;
    path: string;
  };
  page?: {
    id: string;
    title: string;
  };
  frameUrl: string;
};

export const defineIframeScene = (scene: IframeSceneConfig): PageConfig => {
  const pageId = scene.page?.id?.trim() || "iframe";
  const pageTitle = scene.page?.title?.trim() || "Iframe";

  return {
    meta: {
      id: pageId,
      name: pageId,
      title: pageTitle,
      path: `/${pageId}`,
    },
    context: {},
    root: {
      id: `${pageId}-root`,
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
