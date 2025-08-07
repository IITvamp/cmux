/**
 * @deprecated This file is deprecated. File upload functionality is now implemented
 * directly in the provider classes using SFTP for better performance and reliability.
 * See MorphProvider.uploadFile() for the new implementation.
 */

import type { Instance } from 'morphcloud';
import fs from 'fs/promises';
import path from 'path';

/**
 * @deprecated Use provider-specific uploadFile method instead
 * Upload a file to a Morph instance via exec command with base64 encoding
 * This is a fallback method that avoids SFTP complications
 * @param instance - The Morph instance
 * @param localPath - Path to the local file
 * @param remotePath - Path where file should be uploaded on the instance
 */
export async function uploadFile(
  instance: Instance,
  localPath: string,
  remotePath: string
): Promise<void> {
  // Read the local file
  const content = await fs.readFile(localPath, 'utf-8');
  
  // Use uploadFileFromString for consistent behavior
  await uploadFileFromString(instance, content, remotePath);
  
  // Check if the local file is executable and set permissions
  const stats = await fs.stat(localPath);
  if (stats.mode & 0o111) { // Check if any execute bit is set
    await instance.exec(`chmod +x "${remotePath}"`);
  }
}

/**
 * @deprecated Use provider-specific uploadFile method instead
 * Upload a file from content string
 * @param instance - The Morph instance  
 * @param content - File content as string
 * @param remotePath - Path where file should be uploaded on the instance
 */
export async function uploadFileFromString(
  instance: Instance,
  content: string,
  remotePath: string
): Promise<void> {
  // Create remote directory if needed
  const remoteDir = path.dirname(remotePath);
  if (remoteDir && remoteDir !== '/') {
    await instance.exec(`mkdir -p "${remoteDir}"`);
  }

  // Encode content to base64 to avoid shell escaping issues
  const encodedContent = Buffer.from(content).toString('base64');
  
  // Upload using base64 decode
  console.log(`Uploading content to ${remotePath}`);
  const result = await instance.exec(`echo "${encodedContent}" | base64 -d > "${remotePath}"`);
  
  if (result.exit_code !== 0) {
    throw new Error(`Failed to upload file: ${result.stderr || result.stdout}`);
  }
}