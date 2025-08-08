import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'smol-toml';
import { validatePackage, ValidationResult } from './npm.js';

export interface PyProjectInfo {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  'dev-dependencies'?: string[];
}

export interface PythonPackageInfo {
  name: string;
  version: string;
  wheelFiles: string[];
}

interface TomlProjectSection {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  'dev-dependencies'?: string[];
  authors?: Array<string | { name: string; email?: string }>;
  license?: string | { text: string } | { file: string };
  readme?: string;
  homepage?: string;
  repository?: string | { type: string; url: string };
  keywords?: string[];
  classifiers?: string[];
}

/**
 * Validate project section from parsed TOML data
 */
function validateProjectSection(project: any): project is TomlProjectSection {
  if (!project || typeof project !== 'object') {
    console.error('❌ pyproject.toml must contain [project] section');
    return false;
  }

  if (typeof project.name !== 'string' || !project.name.trim()) {
    console.error('❌ Project name must be a non-empty string');
    return false;
  }

  if (typeof project.version !== 'string' || !project.version.trim()) {
    console.error('❌ Project version must be a non-empty string');
    return false;
  }

  // SemVer 기본 형식 검증 (선택적)
  const semverPattern = /^\d+\.\d+\.\d+/;
  if (!semverPattern.test(project.version)) {
    console.warn(
      `⚠️ Version "${project.version}" doesn't follow SemVer pattern`,
    );
  }

  return true;
}

/**
 * Parse pyproject.toml file to extract package information using smol-toml
 */
export function parsePyProjectToml(
  pyprojectPath: string,
): PyProjectInfo | null {
  try {
    if (!fs.existsSync(pyprojectPath)) {
      return null;
    }

    const content = fs.readFileSync(pyprojectPath, 'utf-8');
    const tomlData = toml.parse(content);

    // [project] 섹션에서 안전하게 데이터 추출
    const project = tomlData.project;
    if (!validateProjectSection(project)) {
      return null;
    }

    return {
      name: project.name,
      version: project.version,
      description: project.description || undefined,
      dependencies: Array.isArray(project.dependencies)
        ? project.dependencies.map(String)
        : undefined,
      'dev-dependencies': project['dev-dependencies']
        ? Array.isArray(project['dev-dependencies'])
          ? project['dev-dependencies'].map(String)
          : undefined
        : undefined,
    };
  } catch (error) {
    console.error('❌ Error parsing pyproject.toml:', error);
    if (error instanceof Error) {
      console.error(`   Details: ${error.message}`);
    }
    return null;
  }
}

/**
 * Find wheel files in dist directory
 */
export function findWheelFiles(projectDir: string): string[] {
  const distDir = path.join(projectDir, 'dist');

  if (!fs.existsSync(distDir)) {
    return [];
  }

  const files = fs.readdirSync(distDir);
  return files.filter((file) => file.endsWith('.whl'));
}

/**
 * Get Python package information from project directory
 */
export function getPythonPackageInfo(
  projectDir: string,
): PythonPackageInfo | null {
  const pyprojectPath = path.join(projectDir, 'pyproject.toml');

  const projectInfo = parsePyProjectToml(pyprojectPath);
  if (!projectInfo) {
    return null;
  }

  const wheelFiles = findWheelFiles(projectDir);
  if (wheelFiles.length === 0) {
    console.error(
      '❌ No wheel files found in dist/ directory. Please run `uv build` first.',
    );
    return null;
  }

  return {
    name: projectInfo.name,
    version: projectInfo.version,
    wheelFiles,
  };
}

/**
 * Validate Python package for deployment
 * Uses the same NPM registry validation as JavaScript packages
 * since Python packages are also published to NPM
 */
export async function validatePythonPackage(
  packageName: string,
  packageVersion: string,
  npmToken: string,
): Promise<{
  packageExists: boolean;
  canPublish: boolean;
  versionCheck: { message: string };
  ownershipCheck?: { message: string };
}> {
  console.log(`📋 Validating Python package: ${packageName}@${packageVersion}`);
  console.log(`📋 Python packages are published to NPM registry`);

  try {
    const result = await validatePackage(packageName, packageVersion, npmToken);

    return {
      packageExists: result.packageExists,
      canPublish: result.canPublish,
      versionCheck: {
        message: result.versionCheck.message,
      },
      ownershipCheck: result.ownershipCheck
        ? {
            message: result.ownershipCheck.message,
          }
        : undefined,
    };
  } catch (error) {
    console.error('❌ Error validating Python package:', error);
    return {
      packageExists: false,
      canPublish: false,
      versionCheck: {
        message: `❌ Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}
