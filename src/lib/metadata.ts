import * as fs from 'fs';

export interface DeployConfigs {
  authToken: string;
  defaultDeployRegion: string;
  stdioArgsIndex: string | undefined;
  injectedEnv: Record<string, any> | undefined;
  mcpPath: string;
  packageType: 'js' | 'python';
}

export function parseDeployConfigs(
  deployConfigsPath: string,
): DeployConfigs | null {
  try {
    const content = fs.readFileSync(deployConfigsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function parsePackageJson(packagePath: string): PackageInfo | null {
  try {
    const content = fs.readFileSync(packagePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function getFilesToInclude(packageJson: PackageInfo): string[] {
  const includedFiles = new Set<string>();
  // Always include package.json
  includedFiles.add('package.json');

  const filesFields = packageJson.files;
  if (!filesFields || filesFields.length === 0) {
    console.warn(
      '⚠️ "files" field is empty or not found in package.json. Only "package.json" will be included in the archive.',
    );
    return Array.from(includedFiles);
  }

  filesFields.forEach((file) => includedFiles.add(file));
  return Array.from(includedFiles);
}

export interface PackageInfo {
  name: string;
  version: string;
  main?: string;
  types?: string;
  files?: string[];
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
}
