export type BindingOutputKind = string;

export type DataSourceBindingInfo = {
  id: string;
  hookName: string;
  fetcherName: string;
  baseName: string;
  outputNames: string[];
  defaultOutput?: string;
  callMode?: "hook" | "value";
};

const toPascalCase = (value: string): string => {
  const parts = value.split(/[^a-zA-Z0-9]+/g).filter(Boolean);
  if (!parts.length) {
    return "Output";
  }
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
};

export const getBindingOutputVarName = (
  baseName: string,
  outputName: string
): string => {
  switch (outputName) {
    case "data":
      return `${baseName}Data`;
    case "error":
      return `${baseName}Error`;
    case "isLoading":
      return `${baseName}Loading`;
    case "mutate":
      return `${baseName}Mutate`;
    default:
      return `${baseName}${toPascalCase(outputName)}`;
  }
};

export const resolveBindingOutputVarName = (
  info: DataSourceBindingInfo,
  outputName: string
): string => {
  if (info.callMode === "value") {
    return info.hookName;
  }
  return getBindingOutputVarName(info.baseName, outputName);
};

export const resolveDefaultBindingOutput = (
  outputNames: string[]
): string | undefined => {
  if (outputNames.includes("data")) {
    return "data";
  }
  if (outputNames.length === 1) {
    return outputNames[0];
  }
  if (!outputNames.length) {
    return "data";
  }
  return undefined;
};

export const isBindingOutputDefined = (
  outputNames: string[],
  outputName: string
): boolean => {
  if (!outputNames.length) {
    return true;
  }
  return outputNames.includes(outputName);
};
