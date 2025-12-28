import template from "@babel/template";
import {
  DataSourceDefinition,
  DataSourceDefinitionWithParseTemplate,
  ParseTemplateImport,
} from "./interfaces";
import { JSX_TEMPLATE_OPTIONS } from "../constants";

export class DataSourceRegistry {
  dataSources = new Map<string, DataSourceDefinitionWithParseTemplate>();

  registerDataSource(dataSource: DataSourceDefinition) {
    const dataSourceWithTemplate =
      DataSourceRegistry.parseDataSourceDefinition(dataSource);
    this.dataSources.set(dataSource.id, dataSourceWithTemplate);
  }

  static parseDataSourceDefinition(
    dataSource: DataSourceDefinition
  ): DataSourceDefinitionWithParseTemplate {
    const imports = dataSource.generateCode.imports.map(
      (importPath) => template.statement(importPath, JSX_TEMPLATE_OPTIONS)
    ) as ParseTemplateImport[];
    const stats = dataSource.generateCode.stats.map((stat) => ({
      ...stat,
      template: template.statement(stat.code, JSX_TEMPLATE_OPTIONS),
    }));

    return {
      ...dataSource,
      templates: {
        imports,
        stats,
      },
    };
  }

  getDataSource = (id: string) => {
    return this.dataSources.get(id);
  };

  clear = () => {
    this.dataSources.clear();
  };
}
