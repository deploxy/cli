import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

export interface PackageVersionInfo {
  exists: boolean;
  latestVersion?: string;
  allVersions?: string[];
  isOwner?: boolean;
  canPublish?: boolean;
}

export interface ValidationResult {
  packageExists: boolean;
  canPublish: boolean;
  versionCheck: {
    isValidVersion: boolean;
    message: string;
  };
  ownershipCheck?: {
    isOwner: boolean;
    message: string;
  };
}

/**
 * Fetches package information from the npm registry.
 */
export async function fetchPackageInfo(
  packageName: string,
): Promise<PackageVersionInfo> {
  return new Promise((resolve, reject) => {
    const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

    const request = https.get(registryUrl, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        if (response.statusCode === 404) {
          // Package does not exist
          resolve({
            exists: false,
          });
          return;
        }

        if (response.statusCode !== 200) {
          reject(
            new Error(`npm registry request failed: ${response.statusCode}`),
          );
          return;
        }

        try {
          const packageData = JSON.parse(data);
          const versions = Object.keys(packageData.versions || {});
          const latestVersion = packageData['dist-tags']?.latest;

          resolve({
            exists: true,
            latestVersion,
            allVersions: versions.sort(compareVersions).reverse(), // From latest version
          });
        } catch (error) {
          reject(new Error(`Package information parsing error: ${error}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(new Error(`npm registry connection error: ${error.message}`));
    });

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('npm registry request timeout'));
    });
  });
}

/**
 * Checks for permission to publish a package using an npm token.
 */
export async function checkPublishPermission(
  packageName: string,
  npmToken: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/-/package/${encodeURIComponent(packageName)}/collaborators`;

    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${npmToken}`,
        Accept: 'application/json',
      },
    };

    const request = https.request(url, options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        if (response.statusCode === 404) {
          // If the package doesn't exist or there's no permission,
          // it's possible to publish a new package.
          resolve(true);
          return;
        }

        if (response.statusCode === 200) {
          // Permission granted.
          resolve(true);
          return;
        }

        if (response.statusCode === 401 || response.statusCode === 403) {
          // No permission.
          resolve(false);
          return;
        }

        reject(new Error(`Permission check failed: ${response.statusCode}`));
      });
    });

    request.on('error', (error) => {
      reject(new Error(`Permission check connection error: ${error.message}`));
    });

    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Permission check request timeout'));
    });

    request.end();
  });
}

/**
 * Compares version strings (basic semver rules).
 */
export function compareVersions(a: string, b: string): number {
  const parseVersion = (version: string) => {
    // Remove non-numeric characters from the version (ignores alpha, beta, etc.).
    const cleaned = version.replace(/[^\d.]/g, '');
    return cleaned.split('.').map((num) => parseInt(num) || 0);
  };

  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  const maxLength = Math.max(versionA.length, versionB.length);

  for (let i = 0; i < maxLength; i++) {
    const numA = versionA[i] || 0;
    const numB = versionB[i] || 0;

    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  return 0;
}

/**
 * Checks if the new version is higher than the existing version.
 */
export function isVersionHigher(
  newVersion: string,
  existingVersion: string,
): boolean {
  return compareVersions(newVersion, existingVersion) > 0;
}

/**
 * Performs package validation.
 */
export async function validatePackage(
  packageName: string,
  packageVersion: string,
  npmToken: string,
): Promise<ValidationResult> {
  console.log(
    `🔍 Starting package validation: ${packageName}@${packageVersion}`,
  );

  try {
    // 1. Check if the package exists.
    console.log('📦 Fetching package information from npm registry...');
    const packageInfo = await fetchPackageInfo(packageName);

    if (!packageInfo.exists) {
      console.log('✅ This is a new package. Publishing is allowed.');
      return {
        packageExists: false,
        canPublish: true,
        versionCheck: {
          isValidVersion: true,
          message: 'New package - all versions can be published',
        },
      };
    }

    console.log(
      `📋 Existing package found. Latest version: ${packageInfo.latestVersion}`,
    );

    // 2. Compare versions.
    const versionCheck = {
      isValidVersion: isVersionHigher(
        packageVersion,
        packageInfo.latestVersion!,
      ),
      message: '',
    };

    if (versionCheck.isValidVersion) {
      versionCheck.message = `✅ New version ${packageVersion} is higher than existing version ${packageInfo.latestVersion}.`;
    } else {
      versionCheck.message = `❌ New version ${packageVersion} is not higher than existing version ${packageInfo.latestVersion}.`;
    }

    // 3. Check permissions.
    console.log('🔐 Checking package publish permissions...');
    const hasPermission = await checkPublishPermission(packageName, npmToken);

    const ownershipCheck = {
      isOwner: hasPermission,
      message: hasPermission
        ? '✅ You have package publish permissions.'
        : '❌ You do not have package publish permissions.',
    };

    const canPublish = versionCheck.isValidVersion && hasPermission;

    return {
      packageExists: true,
      canPublish,
      versionCheck,
      ownershipCheck,
    };
  } catch (error) {
    throw new Error(`Error occurred during package validation: ${error}`);
  }
}

async function readNpmrc(targetDir?: string): Promise<string | null> {
  const npmrcPath = path.join(targetDir || process.cwd(), '.npmrc');
  if (!fs.existsSync(npmrcPath)) {
    return null;
  }

  return fs.promises.readFile(npmrcPath, 'utf-8');
}

function getNpmToken(npmrcContent: string): string | null {
  return (
    npmrcContent
      .split('\n')
      .find((line) =>
        line.trim().startsWith('//registry.npmjs.org/:_authToken='),
      )
      ?.split('=')[1] || null
  );
}

export interface NpmCredentials {
  token: string;
  content: string;
}

export async function getNpmCredentials(
  targetDir?: string,
): Promise<NpmCredentials | null> {
  const tokenFromEnv = process.env.NPM_TOKEN;
  let npmrcContent = await readNpmrc(targetDir);

  let token: string | null = null;

  const tokenLinePrefix = '//registry.npmjs.org/:_authToken=';
  const tokenRegex = new RegExp(
    `^${tokenLinePrefix.replace(/\//g, '\\/').replace(/:/g, '\\:')}.*`,
    'm',
  );

  if (tokenFromEnv) {
    console.log('✅ Found NPM token in environment variable (NPM_TOKEN).');
    token = tokenFromEnv;
    const tokenLine = `${tokenLinePrefix}${tokenFromEnv}`;

    if (npmrcContent) {
      if (tokenRegex.test(npmrcContent)) {
        // If token line exists, replace it
        npmrcContent = npmrcContent.replace(tokenRegex, tokenLine);
      } else {
        // If token line does not exist, append it
        npmrcContent = `${npmrcContent.trim()}\n${tokenLine}`;
      }
    } else {
      // If .npmrc file does not exist, create content from scratch
      npmrcContent = tokenLine;
    }
  } else if (npmrcContent) {
    token = getNpmToken(npmrcContent);
    if (token) {
      console.log('✅ Found NPM token in .npmrc file.');
    }
  }

  if (token && npmrcContent) {
    return {
      token,
      content: npmrcContent.trim(),
    };
  }

  return null;
}
