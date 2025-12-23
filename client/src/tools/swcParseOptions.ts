import type { ParseOptions } from "@swc/core";

export const DEFAULT_SWC_PARSE_OPTIONS: ParseOptions = {
  syntax: "typescript",
  tsx: true,
  decorators: true,
  dynamicImport: true,
};
