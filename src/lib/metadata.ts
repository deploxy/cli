import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { parseTsconfig as parseTs } from 'get-tsconfig';

export interface DeployConfigs {
  authToken: string;
  deployRegion: string;
  stdioArgsIndex: string | undefined;
  headers: Record<string, string | number | boolean> | undefined;
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

export function parseTsConfig(tsConfigPath: string): TsConfigInfo | null {
  try {
    // Use get-tsconfig's parseTs to support comments and extends
    const result = parseTs(tsConfigPath);
    return result;
  } catch {
    return null;
  }
}

export function findTsConfig(projectDir: string): string | null {
  const candidates = ['tsconfig.json', 'tsconfig.build.json'];

  for (const candidate of candidates) {
    const configPath = path.join(projectDir, candidate);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

// Precise glob pattern matching using minimatch
function matchesPattern(filePath: string, pattern: string): boolean {
  // Normalize pattern: convert Windows path separators to Unix style
  const normalizedFilePath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // minimatch options
  const options = {
    matchBase: true, // Allow matching basename
    dot: true, // Allow matching hidden files
    nocase: false, // Case-sensitive
  };

  return minimatch(normalizedFilePath, normalizedPattern, options);
}

// Check if it matches an exclude pattern
function isExcluded(filePath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some((pattern) => {
    // Handle various pattern forms
    const patterns = normalizeExcludePattern(pattern);
    return patterns.some((p) => matchesPattern(filePath, p));
  });
}

// Normalize exclude patterns to handle various forms
function normalizeExcludePattern(pattern: string): string[] {
  const patterns: string[] = [];

  // Add original pattern
  patterns.push(pattern);

  // "node_modules" -> ["node_modules", "node_modules/", "node_modules/*", "node_modules/**/*"]
  if (!pattern.includes('*') && !pattern.endsWith('/')) {
    patterns.push(pattern + '/');
    patterns.push(pattern + '/*');
    patterns.push(pattern + '/**/*');
  }

  // "node_modules/" -> ["node_modules/*", "node_modules/**/*"]
  if (pattern.endsWith('/') && !pattern.includes('*')) {
    patterns.push(pattern + '*');
    patterns.push(pattern + '**/*');
  }

  return patterns;
}

export function getFilesToInclude(projectDir: string): string[] {
  const filesToInclude: string[] = [];

  // Always include package.json
  filesToInclude.push('package.json');

  // Include TypeScript config file
  const tsConfigPath = findTsConfig(projectDir);
  if (!tsConfigPath) {
    console.error('❌ tsconfig.json file not found.');
    process.exit(1);
  }

  const tsConfigFileName = path.basename(tsConfigPath);
  filesToInclude.push(tsConfigFileName);

  // Parse tsconfig.json
  const tsConfig = parseTsConfig(tsConfigPath);
  if (!tsConfig) {
    console.error('❌ Unable to parse tsconfig.json file.');
    process.exit(1);
  }

  // Use include array from tsconfig (with defaults)
  const includePatterns = tsConfig.include || ['src/**/*'];
  const excludePatterns = tsConfig.exclude || [
    'node_modules/**/*',
    'dist/**/*',
  ];

  // Collect files/folders based on include patterns
  for (const pattern of includePatterns) {
    if (pattern.includes('*')) {
      // Handle glob patterns
      const basePath = pattern.split('*')[0];
      const baseFullPath = path.join(projectDir, basePath);

      if (fs.existsSync(baseFullPath)) {
        // Include if it doesn't match an exclude pattern
        if (!isExcluded(pattern, excludePatterns)) {
          filesToInclude.push(pattern);
        }
      }
    } else {
      // Handle individual files
      const fullPath = path.join(projectDir, pattern);
      if (fs.existsSync(fullPath)) {
        // Include if it doesn't match an exclude pattern
        if (!isExcluded(pattern, excludePatterns)) {
          filesToInclude.push(pattern);
        }
      }
    }
  }

  // Additional config files to include (after checking exclude patterns)
  const additionalFiles = [
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    '.npmignore',
    '.gitignore',
    'jest.config.js',
    'jest.config.ts',
    'webpack.config.js',
    'rollup.config.js',
    'vite.config.js',
    'vite.config.ts',
    'babel.config.js',
    'babel.config.json',
    '.babelrc',
    'eslint.config.js',
    '.eslintrc.js',
    '.eslintrc.json',
    'prettier.config.js',
    '.prettierrc',
  ];

  for (const file of additionalFiles) {
    const fullPath = path.join(projectDir, file);
    if (fs.existsSync(fullPath) && !isExcluded(file, excludePatterns)) {
      filesToInclude.push(file);
    }
  }

  return filesToInclude;
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

export interface TsConfigInfo {
  include?: string[];
  exclude?: string[];
  compilerOptions?: Record<string, any>;
}
