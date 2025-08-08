#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { createZip, createPythonZip } from './lib/zip.js';
import {
  getFilesToInclude,
  parseDeployConfigs,
  parsePackageJson,
  JsDeployConfigs,
  PyDeployConfigs,
} from './lib/metadata.js';
import {
  CONFIG_FILE_NAME,
  MEMORY_SIZES_MB,
  NODEJS_RUNTIMES,
  PYTHON_RUNTIMES,
  UPLOAD_API_URL,
} from './lib/constant.js';
import { uploadFile } from './lib/upload.js';
import { getNpmCredentials, validatePackage } from './lib/npm.js';
import { getPythonPackageInfo, validatePythonPackage } from './lib/python.js';

function getResolvedPath(targetPath: string | undefined): string {
  const resolvedPath = path.resolve(targetPath || '.');

  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Specified path does not exist: ${resolvedPath}`);
    process.exit(1);
  }

  if (!fs.statSync(resolvedPath).isDirectory()) {
    console.error(`❌ Specified path is not a directory: ${resolvedPath}`);
    process.exit(1);
  }

  return resolvedPath;
}

async function runInit(targetPath: string | undefined) {
  const resolvedPath = getResolvedPath(targetPath);
  console.log('🚀 Initializing...');
  console.log(`📂 Target directory: ${resolvedPath}`);

  const deployConfigPath = path.join(resolvedPath, CONFIG_FILE_NAME);

  if (fs.existsSync(deployConfigPath)) {
    console.log(`✅ ${CONFIG_FILE_NAME} already exists.`);
    return;
  }

  const defaultConfig = {
    authToken: 'YOUR_DEPLOXY_TOKEN',
    defaultDeployRegion: 'us-east-1',
    stdioArgsIndex: '--args',
    packageType: 'js',
    injectedEnv: {},
    nodejsRuntime: NODEJS_RUNTIMES[0].value,
    pythonRuntime: PYTHON_RUNTIMES[0].value,
    memorySizeMB: MEMORY_SIZES_MB[0].value,
  };

  fs.writeFileSync(deployConfigPath, JSON.stringify(defaultConfig, null, 2));
  console.log(`✅ Created ${CONFIG_FILE_NAME} file.`);

  // Add .deploxy.json to .gitignore
  const gitignorePath = path.join(resolvedPath, '.gitignore');
  const gitignoreEntry = `\n# Deploxy configuration file\n${CONFIG_FILE_NAME}\n`;

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(CONFIG_FILE_NAME)) {
      fs.appendFileSync(gitignorePath, gitignoreEntry);
      console.log(`✅ Added ${CONFIG_FILE_NAME} to .gitignore.`);
    } else {
      console.log(`✅ ${CONFIG_FILE_NAME} already exists in .gitignore.`);
    }
  } else {
    fs.writeFileSync(gitignorePath, gitignoreEntry.trimStart());
    console.log(`✅ Created .gitignore and added ${CONFIG_FILE_NAME}.`);
  }

  console.log('');
  console.log(
    '******************************************************************',
  );
  console.log(
    '*                                                                *',
  );
  console.log(
    '*  IMPORTANT: Please create a .npmrc file with your npm auth     *',
  );
  console.log(
    '*  token for package publishing (required for both JS & Python).*',
  );
  console.log(
    '*                                                                *',
  );
  console.log(
    '*  For JavaScript projects: Ensure package.json has bin field   *',
  );
  console.log(
    '*  For Python projects: Run `uv build` to generate wheel files  *',
  );
  console.log(
    '*                                                                *',
  );
  console.log(
    '******************************************************************',
  );
}

async function runDeploy(targetPath: string | undefined) {
  const currentDir = getResolvedPath(targetPath);
  console.log('🚀 Starting deployment...');
  console.log('📂 Working directory:', currentDir);

  // 1. Read AUTH_TOKEN from .deploxy.json file
  const deployConfigsPath = path.join(currentDir, CONFIG_FILE_NAME);
  if (!fs.existsSync(deployConfigsPath)) {
    console.log('');
    console.log(
      '******************************************************************',
    );
    console.log(
      '*                                                                *',
    );
    console.log(
      '*  Configuration file not found!                                 *',
    );
    console.log(
      '*  Please run `@deploxy/cli init` to create a new config file.  *',
    );
    console.log(
      '*                                                                *',
    );
    console.log(
      '******************************************************************',
    );
    process.exit(1);
  }

  const deployConfigs = parseDeployConfigs(deployConfigsPath);
  if (!deployConfigs?.authToken || !deployConfigs.defaultDeployRegion) {
    console.error(`❌ ${CONFIG_FILE_NAME} file is missing required fields.`);
    process.exit(1);
  }

  // Type assertion to help TypeScript understand the type
  const validatedConfigs = deployConfigs!;

  if (validatedConfigs.memorySizeMB) {
    if (
      !MEMORY_SIZES_MB.some(
        (mem) => mem.value === validatedConfigs.memorySizeMB,
      )
    ) {
      console.error(
        `❌ Invalid memory size: ${validatedConfigs.memorySizeMB}. Please use one of the following: ${MEMORY_SIZES_MB.map((mem) => mem.value).join(', ')}`,
      );
      process.exit(1);
    }
  }

  // Validate runtime based on package type
  if (validatedConfigs.packageType === 'js') {
    if (validatedConfigs.runtime) {
      if (
        !NODEJS_RUNTIMES.some(
          (runtime) => runtime.value === validatedConfigs.runtime,
        )
      ) {
        console.error(
          `❌ Invalid Node.js runtime: ${validatedConfigs.runtime}. Please use one of the following: ${NODEJS_RUNTIMES.map((runtime) => runtime.value).join(', ')}`,
        );
        process.exit(1);
      }
    }
  } else if (validatedConfigs.packageType === 'py') {
    if (validatedConfigs.runtime) {
      if (
        !PYTHON_RUNTIMES.some(
          (runtime) => runtime.value === validatedConfigs.runtime,
        )
      ) {
        console.error(
          `❌ Invalid Python runtime: ${validatedConfigs.runtime}. Please use one of the following: ${PYTHON_RUNTIMES.map((runtime) => runtime.value).join(', ')}`,
        );
        process.exit(1);
      }
    }
  } else {
    console.error(
      `❌ Invalid package type: ${(validatedConfigs as any).packageType}. Please use 'js' or 'py'.`,
    );
    process.exit(1);
  }

  console.log(`✅ ${CONFIG_FILE_NAME} file parsed successfully`);

  if (validatedConfigs.packageType === 'js') {
    await deployJsPackage(currentDir, validatedConfigs as JsDeployConfigs);
  } else if (validatedConfigs.packageType === 'py') {
    await deployPythonPackage(currentDir, validatedConfigs as PyDeployConfigs);
  }

  console.log('🎉 All tasks completed successfully!');
}

async function deployJsPackage(
  currentDir: string,
  deployConfigs: JsDeployConfigs,
) {
  // 2. Find package.json
  const packageJsonPath = path.join(currentDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json file not found.');
    process.exit(1);
  }

  const packageInfo = parsePackageJson(packageJsonPath);
  if (!packageInfo) {
    console.error('❌ Unable to parse package.json file.');
    process.exit(1);
  }
  const packageName = packageInfo.name;
  const packageVersion = packageInfo.version;

  if (!packageInfo.bin || Object.keys(packageInfo.bin).length !== 1) {
    console.error('❌ There must be only one [bin] field.');
    process.exit(1);
  }
  const [mcpEntryFilePath] = Object.values(packageInfo.bin);

  // Perform npm package validation
  console.log('');
  console.log('='.repeat(50));
  console.log('📦 NPM Package Validation');
  console.log('='.repeat(50));

  const npmCredentials = await getNpmCredentials(currentDir);
  if (!npmCredentials) {
    console.error(
      '❌ NPM token not found. Please create a .npmrc file or set NPM_TOKEN environment variable.',
    );
    process.exit(1);
  }
  const { token: npmToken, content: npmrcContent } = npmCredentials;

  const validationResult = await validatePackage(
    packageName,
    packageVersion,
    npmToken,
  );

  console.log('');
  console.log('📋 Validation Results:');
  console.log(
    `  - Package exists: ${validationResult.packageExists ? 'Yes' : 'No'}`,
  );
  console.log(`  - ${validationResult.versionCheck.message}`);

  if (validationResult.ownershipCheck) {
    console.log(`  - ${validationResult.ownershipCheck.message}`);
  }

  if (!validationResult.canPublish) {
    console.log('');
    console.error(
      '❌ Cannot publish package. Please check the validation results above.',
    );
    process.exit(1);
  }

  console.log('');
  console.log('✅ Package validation completed! Proceeding with deployment.');
  console.log('='.repeat(50));

  console.log(
    '✅ package.json parsed successfully:',
    packageInfo.name,
    packageInfo.version,
  );

  // 3. Check list of files to compress
  const filesToInclude = getFilesToInclude(packageInfo);
  console.log('📋 Files to compress:');
  filesToInclude.forEach((file) => console.log(`  - ${file}`));

  // 4. Compress files to output.zip
  const outputZipPath = path.join(currentDir, 'output.zip');

  // Delete existing output.zip file if it exists
  if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
  }

  console.log('📦 Starting compression...');
  await createZip(currentDir, outputZipPath, filesToInclude);

  // 5. Upload compressed file
  const apiUrl = UPLOAD_API_URL;
  console.log('📤 Starting file upload...');
  await uploadFile({
    packageName,
    packageVersion,
    filePath: outputZipPath,
    npmrcContent,
    apiUrl,
    mcpEntryFilePath,
    deployConfigs,
  });

  // 6. Clean up temporary files
  if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
    console.log('🧹 Temporary file cleanup completed');
  }
}

async function deployPythonPackage(
  currentDir: string,
  deployConfigs: PyDeployConfigs,
) {
  // 2. Find pyproject.toml and get Python package info
  const pythonPackageInfo = getPythonPackageInfo(currentDir);
  if (!pythonPackageInfo) {
    console.error(
      '❌ Failed to get Python package information. Please ensure pyproject.toml exists and dist/ contains wheel files.',
    );
    process.exit(1);
  }

  const {
    name: packageName,
    version: packageVersion,
    wheelFiles,
    scripts,
  } = pythonPackageInfo;
  console.log(`✅ Python package info: ${packageName}@${packageVersion}`);
  console.log(`📦 Found wheel files: ${wheelFiles.join(', ')}`);

  // Get the first script from [project.scripts] for mcpEntryFilePath
  let mcpEntryFilePath: string;
  if (scripts && Object.keys(scripts).length > 0) {
    const firstScriptName = Object.keys(scripts)[0];
    mcpEntryFilePath = firstScriptName;
    console.log(`✅ Using script entry: ${firstScriptName}`);
  } else {
    console.error(
      '❌ No scripts found in pyproject.toml [project.scripts]. Please define at least one script entry.',
    );
    process.exit(1);
  }

  // For Python packages, we still need NPM token for authentication
  console.log('');
  console.log('='.repeat(50));
  console.log('📦 Python Package Validation');
  console.log('='.repeat(50));

  const npmCredentials = await getNpmCredentials(currentDir);
  if (!npmCredentials) {
    console.error(
      '❌ NPM token not found. Please create a .npmrc file or set NPM_TOKEN environment variable.',
    );
    process.exit(1);
  }
  const { token: npmToken, content: npmrcContent } = npmCredentials;

  const validationResult = await validatePythonPackage(
    packageName,
    packageVersion,
    npmToken,
  );

  console.log('');
  console.log('📋 Validation Results:');
  console.log(
    `  - Package exists: ${validationResult.packageExists ? 'Yes' : 'No'}`,
  );
  console.log(`  - ${validationResult.versionCheck.message}`);

  if (validationResult.ownershipCheck) {
    console.log(`  - ${validationResult.ownershipCheck.message}`);
  }

  if (!validationResult.canPublish) {
    console.log('');
    console.error(
      '❌ Cannot publish package. Please check the validation results above.',
    );
    process.exit(1);
  }

  console.log('');
  console.log('✅ Package validation completed! Proceeding with deployment.');
  console.log('='.repeat(50));

  // 3. Compress wheel files to output.zip
  const outputZipPath = path.join(currentDir, 'output.zip');

  // Delete existing output.zip file if it exists
  if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
  }

  console.log('📦 Starting Python package compression...');
  await createPythonZip(currentDir, outputZipPath, wheelFiles);

  // 4. Upload compressed file
  const apiUrl = UPLOAD_API_URL;
  console.log('📤 Starting file upload...');

  await uploadFile({
    packageName,
    packageVersion,
    filePath: outputZipPath,
    npmrcContent,
    apiUrl,
    mcpEntryFilePath,
    deployConfigs,
  });

  // 5. Clean up temporary files
  if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
    console.log('🧹 Temporary file cleanup completed');
  }
}

async function main() {
  const program = new Command();
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
  );

  program
    .name('@deploxy/cli')
    .description('CLI tool to initialize and deploy MCP proxy packages')
    .version(packageJson.version);

  program
    .command('init')
    .description(`Initialize a new project with a ${CONFIG_FILE_NAME} file`)
    .argument('[path]', 'The path to initialize the project in', '.')
    .action(runInit);

  program
    .command('deploy')
    .description('Deploy the project')
    .argument('[path]', 'The path to the project to deploy', '.')
    .action(runDeploy);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error occurred:', errorMessage);
    process.exit(1);
  }
}

main();
