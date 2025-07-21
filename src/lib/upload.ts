import * as fs from 'fs';
import * as path from 'path';
import { DeployConfigs } from './metadata';

export async function uploadFile({
  packageName,
  packageVersion,
  filePath,
  npmrcContent,
  apiUrl,
  deployConfigs,
}: {
  packageName: string;
  packageVersion: string;
  filePath: string;
  npmrcContent: string;
  apiUrl: string;
  deployConfigs: DeployConfigs;
}): Promise<void> {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileBlob = new Blob([fileBuffer], { type: 'application/zip' });

    const form = new FormData();
    form.append('file', fileBlob, path.basename(filePath));
    form.append('packageName', packageName);
    form.append('packageVersion', packageVersion);
    form.append('npmrcContent', npmrcContent);
    form.append('defaultDeployRegion', deployConfigs.defaultDeployRegion);
    form.append('packageType', deployConfigs.packageType);
    form.append('nodejsRuntime', deployConfigs.nodejsRuntime);
    form.append('memorySizeMB', deployConfigs.memorySizeMB.toString());

    if (deployConfigs.injectedEnv) {
      form.append('injectedEnv', JSON.stringify(deployConfigs.injectedEnv));
    }
    if (deployConfigs.stdioArgsIndex) {
      form.append('stdioArgsIndex', deployConfigs.stdioArgsIndex);
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deployConfigs.authToken}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Upload failed with status ${response.status}: ${errorText}`,
      );
    }

    const responseData = await response.json();
    console.log('✅ File upload successful!');
    console.log('Response:', responseData);
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  }
}
