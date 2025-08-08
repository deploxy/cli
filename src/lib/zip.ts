import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

export function createZip(
  projectDir: string,
  outputPath: string,
  filesToInclude: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip();

      // Add files to the zip
      for (const filePattern of filesToInclude) {
        const fullPath = path.join(projectDir, filePattern);

        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            // If it's a directory, use adm-zip's addLocalFolder
            zip.addLocalFolder(fullPath, filePattern);
          } else {
            // If it's a file, use adm-zip's addLocalFile
            zip.addLocalFile(
              fullPath,
              path.dirname(filePattern),
              path.basename(filePattern),
            );
          }
        } else if (filePattern.includes('*')) {
          // If it's a glob pattern (simple implementation)
          const basePath = filePattern.split('*')[0];
          const baseFullPath = path.join(projectDir, basePath);

          if (
            fs.existsSync(baseFullPath) &&
            fs.statSync(baseFullPath).isDirectory()
          ) {
            zip.addLocalFolder(baseFullPath, basePath);
          }
        }
      }

      // Save the zip file
      zip.writeZip(outputPath);

      const stats = fs.statSync(outputPath);
      console.log(`📦 Compression completed: ${stats.size} bytes`);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Create zip file for Python wheel packages
 * Creates output.zip containing dist/{PKG_NAME}.whl structure
 */
export function createPythonZip(
  projectDir: string,
  outputPath: string,
  wheelFiles: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip();
      const distDir = path.join(projectDir, 'dist');

      // Add each wheel file to the zip maintaining the dist/ structure
      for (const wheelFile of wheelFiles) {
        const wheelPath = path.join(distDir, wheelFile);
        
        if (fs.existsSync(wheelPath)) {
          // Add file to zip with dist/ prefix to maintain structure
          zip.addLocalFile(wheelPath, 'dist', wheelFile);
          console.log(`📦 Added to zip: dist/${wheelFile}`);
        } else {
          throw new Error(`Wheel file not found: ${wheelPath}`);
        }
      }

      // Save the zip file
      zip.writeZip(outputPath);

      const stats = fs.statSync(outputPath);
      console.log(`📦 Python package compression completed: ${stats.size} bytes`);
      console.log(`📦 Zip contains: ${wheelFiles.map(f => `dist/${f}`).join(', ')}`);
      
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}
