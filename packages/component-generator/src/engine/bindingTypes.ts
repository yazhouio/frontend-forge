export type BindingOutputKind = "data" | "error" | "isLoading" | "mutate";

export type DataSourceBindingInfo = {
  id: string;
  hookName: string;
  fetcherName: string;
  baseName: string;
  dataName: string;
  errorName: string;
  loadingName: string;
  mutateName: string;
};
