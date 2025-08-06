import * as fs from 'fs';
import { MEMORY_SIZES_MB, NODEJS_RUNTIMES } from './constant.js';

export type NodejsRuntime = (typeof NODEJS_RUNTIMES)[number]['value'];

export type MemorySizeMB = (typeof MEMORY_SIZES_MB)[number]['value'];

export interface PackageManagerConfigs {
  manager: 'npm' | 'yarn' | 'pnpm';
  installCommand: string;
}

export interface DeployConfigs {
  authToken: string;
  defaultDeployRegion: string;
  stdioArgsIndex: string | undefined;
  injectedEnv: Record<string, any> | undefined;
  packageType: 'js' | 'python';
  nodejsRuntime: NodejsRuntime;
  memorySizeMB: MemorySizeMB;
  packageManager?: PackageManagerConfigs;
}

export interface UploadPayload {
  packageName: string;
  packageVersion: string;
  npmrcContent: string;
  mcpEntryFilePath: string;
  deployConfigs: DeployConfigs;
}

/**
 * Substitutes environment variable placeholders in a string.
 * e.g., "${process.env.MY_VAR}" will be replaced by the value of MY_VAR.
 * @param content The string content to process.
 * @returns The string with environment variables substituted.
 */
function substituteEnvVars(content: string): string {
  // This regex finds placeholders like ${process.env.VAR_NAME}
  const regex = /\$\{\s*process\.env\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}/g;

  return content.replace(regex, (match, varName) => {
    const envVar = process.env[varName];

    if (envVar === undefined) {
      console.warn(`⚠️  Environment variable "${varName}" is not set.`);
      return ''; // Replace with empty string if not found
    }

    // JSON.stringify escapes the string and wraps it in quotes.
    // We remove the outer quotes because the placeholder is already inside quotes in the JSON file.
    return JSON.stringify(envVar).slice(1, -1);
  });
}

export function parseDeployConfigs(
  deployConfigsPath: string,
): DeployConfigs | null {
  try {
    const content = fs.readFileSync(deployConfigsPath, 'utf-8');
    const substitutedContent = substituteEnvVars(content);
    return JSON.parse(substitutedContent);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(
        '❌ Error parsing .deploxy.json. This might be due to a syntax error in the file or an issue with environment variable substitution.',
      );
    }
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
