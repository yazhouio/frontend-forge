import { Fragment, useCallback, useEffect } from "react";
import type { ComponentType, ReactNode } from "react";
import React from "react";
import { create } from "zustand";

type ModalVisibleProps = {
  visible?: boolean;
};

type ModalConfig<TProps extends ModalVisibleProps> = {
  id: string;
  modal: ComponentType<TProps>;
  deps?: Partial<TProps>;
};

type ModalEntry = {
  id: string;
  modal: ComponentType<any>;
  deps?: Record<string, unknown>;
  visible: boolean;
};

type ModalStore = {
  modals: Record<string, ModalEntry>;
  ensureModal: (
    id: string,
    modal: ComponentType<any>,
    deps?: Record<string, unknown>,
  ) => void;
  setDeps: (id: string, deps: Record<string, unknown>) => void;
  removeModal: (id: string) => void;
  setVisible: (id: string, visible: boolean) => void;
};

const CLOSE_REMOVE_DELAY = 300;
const closeTimers = new Map<string, ReturnType<typeof setTimeout>>();

const useModalStore = create<ModalStore>((set) => ({
  modals: {},
  ensureModal: (id, modal, deps) =>
    set((state) => {
      const existing = state.modals[id];
      return {
        modals: {
          ...state.modals,
          [id]: {
            id,
            modal,
            deps: deps ?? existing?.deps ?? {},
            visible: existing?.visible ?? false,
          },
        },
      };
    }),
  setDeps: (id, deps) =>
    set((state) => {
      const existing = state.modals[id];
      if (!existing) return state;
      return {
        modals: {
          ...state.modals,
          [id]: {
            ...existing,
            deps: {
              ...(existing.deps ?? {}),
              ...deps,
            },
          },
        },
      };
    }),
  removeModal: (id) =>
    set((state) => {
      if (!state.modals[id]) return state;
      const next = { ...state.modals };
      delete next[id];
      return { modals: next };
    }),
  setVisible: (id, visible) =>
    set((state) => {
      const existing = state.modals[id];
      if (!existing || existing.visible === visible) return state;
      return {
        modals: {
          ...state.modals,
          [id]: {
            ...existing,
            visible,
          },
        },
      };
    }),
}));

export const useModalAction = <TProps extends ModalVisibleProps>(
  config: ModalConfig<TProps>,
): { open: (modalProps?: Partial<TProps>) => void; close: () => void } => {
  const ensureModal = useModalStore((state) => state.ensureModal);
  const setDeps = useModalStore((state) => state.setDeps);
  const removeModal = useModalStore((state) => state.removeModal);
  const setVisible = useModalStore((state) => state.setVisible);

  useEffect(() => {
    return () => {
      const timer = closeTimers.get(config.id);
      if (timer) {
        clearTimeout(timer);
        closeTimers.delete(config.id);
      }
      removeModal(config.id);
    };
  }, [config.id, removeModal]);

  useEffect(() => {
    ensureModal(config.id, config.modal, config.deps);
  }, [config.id, config.modal, config.deps, ensureModal]);

  useEffect(() => {
    if (config.deps) {
      setDeps(config.id, config.deps as Record<string, unknown>);
    }
  }, [config.id, config.deps, setDeps]);

  const open = useCallback(
    (modalProps?: Partial<TProps>) => {
      const timer = closeTimers.get(config.id);
      if (timer) {
        clearTimeout(timer);
        closeTimers.delete(config.id);
      }
      ensureModal(
        config.id,
        config.modal,
        (modalProps as Record<string, unknown> | undefined) ?? config.deps,
      );
      if (modalProps) {
        setDeps(config.id, modalProps as Record<string, unknown>);
      }
      setVisible(config.id, true);
    },
    [config.id, config.modal, config.deps, ensureModal, setDeps, setVisible],
  );

  const close = useCallback(() => {
    setVisible(config.id, false);
    const timer = closeTimers.get(config.id);
    if (timer) {
      clearTimeout(timer);
    }
    closeTimers.set(
      config.id,
      setTimeout(() => {
        removeModal(config.id);
        closeTimers.delete(config.id);
      }, CLOSE_REMOVE_DELAY),
    );
  }, [config.id, removeModal, setVisible]);

  return { open, close };
};

export type ModalProviderProps = {
  children?: ReactNode;
};

export const ModalProvider = ({ children }: ModalProviderProps) => {
  const modals = useModalStore((state) => state.modals);

  const defaultRenderModal = (entry: ModalEntry) => {
    const ModalComponent = entry.modal;
    const props = {
      ...(entry.deps ?? {}),
      visible: entry.visible,
    } as Record<string, unknown>;

    return <ModalComponent key={entry.id} {...props} />;
  };

  return (
    <Fragment>
      {children}
      {Object.values(modals).map((entry) => {
        return defaultRenderModal(entry);
      })}
    </Fragment>
  );
};

export const wrapperComponentModal = <TProps extends object>(
  Component: ComponentType<TProps>,
) => {
  const WrappedComponent = (props: TProps) => {
    return (
      <ModalProvider>
        <Component {...props} />
      </ModalProvider>
    );
  };

  WrappedComponent.displayName = `ModalProvider(${Component.displayName ?? Component.name ?? "Component"})`;
  return WrappedComponent;
};
