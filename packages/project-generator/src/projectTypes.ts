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

export type VirtualFile = {
  path: string;
  content: string;
};

export type ProjectFile = VirtualFile;

export type GenerateProjectFilesOptions = {
  componentGenerator: ComponentGenerator;
  build?: boolean;
  archive?: boolean;
  onLog?: (message: string) => void;
};

export type GenerateProjectFilesResult = {
  files: VirtualFile[];
  warnings: string[];
};
