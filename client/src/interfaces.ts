export interface ImportSpecIR {
  from: string;
  default?: string;
  namespace?: Set<string>;
  named?: Map<string, string | true>;
  sideEffect?: true;
  typeOnly?: boolean;
  source?: {
    nodeId?: string;
    dataSourceId?: string;
  };
}
