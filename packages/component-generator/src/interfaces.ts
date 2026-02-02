export interface PageRuntimeCore {
  page: {
    id: string;
  };
  route: {
    current: string;
  };
  navigation: {
    navigate(to: string | number): void;
    goBack: () => void;
  };
}

export interface RuntimeContextInfo extends PageRuntimeCore {
  capabilities?: Record<string, any>;
  permissions?: Record<string, boolean>;
  features?: Record<string, boolean>;
  meta?: Record<string, any>;
}
