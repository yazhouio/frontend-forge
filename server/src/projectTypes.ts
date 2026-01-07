export type RouteMeta = {
  path: string;
  pageId: string;
};

export type MenuMeta = {
  parent: string;
  name: string;
  title: string;
  icon?: string;
  order?: number;
  clusterModule?: string;
};

export type LocaleMeta = {
  lang: string;
  messages: Record<string, string>;
};

export type PageMeta = {
  id: string;
  entryComponent: string;
  componentsTree: unknown;
};

export type ExtensionManifest = {
  version: "1.0";
  name: string;
  displayName?: string;
  description?: string;
  routes: RouteMeta[];
  menus: MenuMeta[];
  locales: LocaleMeta[];
  pages: PageMeta[];
  build?: {
    target: "kubesphere-extension";
    moduleName?: string;
    systemjs?: boolean;
  };
};

export type ComponentGenerator = (
  page: PageMeta,
  manifest: ExtensionManifest
) => string;

export type GenerateProjectOptions = {
  outputDir: string;
  componentGenerator: ComponentGenerator;
  allowNonEmptyDir?: boolean;
  build?: boolean;
  archive?: boolean;
  onLog?: (message: string) => void;
};

export type GenerateProjectResult = {
  outputDir: string;
  warnings: string[];
};
