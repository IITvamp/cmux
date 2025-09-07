import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Custom Vite plugin to resolve workspace packages and ensure they're bundled
export function resolveWorkspacePackages() {
  return {
    name: 'resolve-workspace-packages',
    enforce: 'pre',
    resolveId(id, importer) {
      // Map workspace packages to their actual source files
      // These will be transpiled by Vite during the build
      
      if (id === '@cmux/convex/api') {
        return resolvePath(__dirname, '../../packages/convex/convex/_generated/api.js');
      }
      
      if (id === '@cmux/server/realtime') {
        return resolvePath(__dirname, '../../apps/server/src/realtime.ts');
      }
      
      if (id === '@cmux/server/socket-handlers') {
        return resolvePath(__dirname, '../../apps/server/src/socket-handlers.ts');
      }
      
      if (id === '@cmux/server/gitDiff') {
        return resolvePath(__dirname, '../../apps/server/src/gitDiff.ts');
      }
      
      if (id === '@cmux/server/server') {
        return resolvePath(__dirname, '../../apps/server/src/server.ts');
      }
      
  if (id === '@cmux/server') {
        return resolvePath(__dirname, '../../apps/server/src/index.ts');
      }
      // Explicit electron entry to avoid .js extension mismatch inside server index
      if (id === '@cmux/server/electron-server') {
        return resolvePath(__dirname, '../../apps/server/src/electron-server.ts');
      }
      
      if (id === '@cmux/shared' || id === '@cmux/shared/index') {
        return resolvePath(__dirname, '../../packages/shared/src/index.ts');
      }
      // Explicit subpath mappings for shared
      if (id === '@cmux/shared/socket') {
        return resolvePath(__dirname, '../../packages/shared/src/socket-client.ts');
      }
      if (id === '@cmux/shared/node/socket') {
        return resolvePath(__dirname, '../../packages/shared/src/node/socket-server.ts');
      }
      
      if (id === '@cmux/convex') {
        return resolvePath(__dirname, '../../packages/convex/convex/_generated/server.js');
      }
      
      // Handle subpath imports for shared
      if (id.startsWith('@cmux/shared/')) {
        const subpath = id.slice('@cmux/shared/'.length);
        return resolvePath(__dirname, `../../packages/shared/src/${subpath}.ts`);
      }
      
      return null;
    }
  };
}
