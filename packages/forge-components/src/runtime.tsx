import * as React from "react";

export type RuntimePageInfo = {
  id: string;
};

export type RuntimeLocation = {
  pathname: string;
  search: string;
  hash: string;
  href: string;
};

export type RuntimeNavigation = {
  navigate: (to: string) => void;
  goBack: () => void;
};

export type RuntimeContextValue = {
  page: RuntimePageInfo;
  location: RuntimeLocation;
  navigation: RuntimeNavigation;
};

const RuntimeContext = React.createContext<RuntimeContextValue | null>(null);

const readWindowLocation = (): RuntimeLocation => {
  if (typeof window === "undefined" || !window.location) {
    return { pathname: "", search: "", hash: "", href: "" };
  }
  const { pathname, search, hash, href } = window.location;
  return { pathname, search, hash, href };
};

const createNavigation = (): RuntimeNavigation => ({
  navigate: (to) => {
    if (typeof window === "undefined") {
      return;
    }
    if (typeof to !== "string") {
      return;
    }
    if (window.history && window.history.pushState) {
      window.history.pushState({}, "", to);
      const event =
        typeof PopStateEvent === "function"
          ? new PopStateEvent("popstate")
          : new Event("popstate");
      window.dispatchEvent(event);
      return;
    }
    window.location.assign(to);
  },
  goBack: () => {
    if (typeof window === "undefined") {
      return;
    }
    if (window.history) {
      window.history.back();
    }
  },
});

export type RuntimeProviderProps = React.PropsWithChildren<{
  runtime: RuntimeContextValue;
}>;

export function RuntimeProvider({ runtime, children }: RuntimeProviderProps) {
  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}

export function useRuntimeContext(): RuntimeContextValue {
  const runtime = React.useContext(RuntimeContext);
  if (!runtime) {
    throw new Error("RuntimeProvider is missing.");
  }
  return runtime;
}

export type RuntimeInit = {
  page: RuntimePageInfo;
  location?: RuntimeLocation;
  navigation?: RuntimeNavigation;
};

export function createRuntime(init: RuntimeInit): RuntimeContextValue {
  return {
    page: init.page,
    location: init.location ?? readWindowLocation(),
    navigation: init.navigation ?? createNavigation(),
  };
}

export function withPageRuntime<P>(
  Page: React.ComponentType<P>,
  page: RuntimePageInfo
) {
  function RuntimeWrappedPage(props: P) {
    const runtime = React.useMemo(() => createRuntime({ page }), [page.id]);
    return (
      <RuntimeProvider runtime={runtime}>
        <Page {...props} />
      </RuntimeProvider>
    );
  }

  const pageName = Page.displayName || Page.name || "Page";
  RuntimeWrappedPage.displayName = `RuntimeWrapped(${pageName})`;
  return RuntimeWrappedPage;
}
