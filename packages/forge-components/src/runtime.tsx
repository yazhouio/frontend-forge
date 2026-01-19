import * as React from "react";
import type { RuntimeContextInfo } from "./runtime/types";

const RuntimeContext = React.createContext<RuntimeContextInfo | null>(null);

export type RuntimeProviderProps = React.PropsWithChildren<{
  value: RuntimeContextInfo;
}>;

export function RuntimeProvider({ value, children }: RuntimeProviderProps) {
  return (
    <RuntimeContext.Provider value={value}>
      {children}
    </RuntimeContext.Provider>
  );
}

export function useRuntimeContext(): RuntimeContextInfo {
  const runtime = React.useContext(RuntimeContext);
  if (!runtime) {
    throw new Error("RuntimeProvider is missing.");
  }
  return runtime;
}

export type { RuntimeContextInfo };
