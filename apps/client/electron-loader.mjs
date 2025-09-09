// Custom ESM loader to resolve .js imports to .ts files for @cmux/server
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  // Handle .js imports from @cmux/server that should resolve to .ts
  if (specifier.endsWith('.js') && specifier.includes('/apps/server/src/')) {
    const tsSpecifier = specifier.replace(/\.js$/, '.ts');
    try {
      // Check if the .ts file exists
      const tsPath = fileURLToPath(new URL(tsSpecifier));
      if (existsSync(tsPath)) {
        return nextResolve(tsSpecifier, context);
      }
    } catch {
      // Fall through to default resolution
    }
  }
  
  // Handle relative .js imports that should resolve to .ts
  if (specifier.startsWith('./') && specifier.endsWith('.js')) {
    const parentURL = context.parentURL;
    if (parentURL && parentURL.includes('/apps/server/src/')) {
      const tsSpecifier = specifier.replace(/\.js$/, '.ts');
      return nextResolve(tsSpecifier, context);
    }
  }
  
  return nextResolve(specifier, context);
}