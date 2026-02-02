export interface RuntimeContextInfo {
  page: {
    id: string;
    params?: Record<string, string>;
  };
  route: {
    current: string;
    params: Record<string, string>;
    query: Record<string, string>;
  };
  location: {
    pathname: string;
    search: string;
    hash: string;
  };
  navigation: {
    navigate: (to: string | number) => void;
    goBack: () => void;
  };
  permissions?: Record<string, boolean>;
  features?: Record<string, boolean>;
  meta?: Record<string, any>;
  capabilities?: Record<string, any>;
}
