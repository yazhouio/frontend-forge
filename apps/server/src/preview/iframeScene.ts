import type { IframeSceneConfig } from "./defineIframeScene.js";

export const IframeScene: IframeSceneConfig = {
  meta: {
    id: "iframe",
    name: "Iframe",
    title: "Iframe",
    path: "/iframe",
  },
  frameUrl: "/proxy/weave.works/#!/state/{\"topologyId\":\"pods\"}",
};
