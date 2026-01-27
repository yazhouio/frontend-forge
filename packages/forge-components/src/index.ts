import { lruCache } from "./utils/cache";
lruCache.hydrate();

export * from "./components";
export {
  useModalAction,
  wrapperComponentModal,
  ModalProvider,
} from "./hooks/useModalAction";
export * from "./runtime";
export * from "./stores";
export * from "./utils";

export const init = () => {
  lruCache.hydrate();
};
