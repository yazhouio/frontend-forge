import type {
  ExtensionManifest,
  GenerateProjectFilesOptions,
  GenerateProjectFilesResult
} from './projectTypes.js';
import { generateProjectFiles } from './projectGenerator.js';

export class ProjectGenerator {
  generateProjectFiles(
    manifest: ExtensionManifest,
    options: GenerateProjectFilesOptions
  ): GenerateProjectFilesResult {
    return generateProjectFiles(manifest, options);
  }

  generate(
    manifest: ExtensionManifest,
    options: GenerateProjectFilesOptions
  ): GenerateProjectFilesResult {
    return this.generateProjectFiles(manifest, options);
  }
}
