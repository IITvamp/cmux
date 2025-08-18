import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildStyles() {
  const css = await fs.readFile(path.join(__dirname, 'src/styles.css'), 'utf8');
  
  const result = await postcss([
    tailwindcss(path.join(__dirname, 'tailwind.config.js')),
    autoprefixer,
  ]).process(css, {
    from: path.join(__dirname, 'src/styles.css'),
    to: path.join(__dirname, 'dist/styles.css'),
  });

  // Write the CSS file
  await fs.writeFile(path.join(__dirname, 'dist/styles.css'), result.css);
  
  // Create a JS module that exports the CSS as a string
  const jsContent = `export const styles = ${JSON.stringify(result.css)};\n`;
  await fs.writeFile(path.join(__dirname, 'dist/styles.js'), jsContent);
  
  // Create TypeScript definition
  const dtsContent = `export declare const styles: string;\n`;
  await fs.writeFile(path.join(__dirname, 'dist/styles.d.ts'), dtsContent);
}

buildStyles().catch(console.error);