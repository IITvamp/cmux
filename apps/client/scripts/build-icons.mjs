#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import png2icons from 'png2icons';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pickLargestPng(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const pngs = await Promise.all(
    entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.png'))
      .map(async (e) => {
        const full = path.join(dir, e.name);
        const stat = await fs.stat(full);
        return { name: e.name, full, size: stat.size };
      })
  );
  if (pngs.length === 0) {
    throw new Error(`No PNGs found in ${dir}`);
  }
  pngs.sort((a, b) => b.size - a.size);
  return pngs[0].full;
}

async function main() {
  const clientDir = path.resolve(__dirname, '..');
  const iconsetDir = path.join(clientDir, 'assets', 'cmux-logos', 'cmux.iconset');
  const buildDir = path.join(clientDir, 'build');
  const icnsOut = path.join(buildDir, 'icon.icns');
  const icoOut = path.join(buildDir, 'icon.ico');

  try {
    await fs.access(icnsOut);
    await fs.access(icoOut);
    console.log('[build-icons] Icons already exist, skipping');
    return;
  } catch {}

  console.log('[build-icons] Generating app icons...');
  await ensureDir(buildDir);

  const srcPng = await pickLargestPng(iconsetDir);
  const pngBuf = await fs.readFile(srcPng);

  // Generate ICNS
  const icnsBuf = png2icons.createICNS(pngBuf, png2icons.BICUBIC, 0, false);
  if (!icnsBuf) {
    throw new Error('Failed to generate ICNS');
  }
  await fs.writeFile(icnsOut, icnsBuf);

  // Generate ICO
  const icoBuf = png2icons.createICO(pngBuf, png2icons.BICUBIC, 0, false, true);
  if (!icoBuf) {
    throw new Error('Failed to generate ICO');
  }
  await fs.writeFile(icoOut, icoBuf);

  console.log('[build-icons] Wrote', icnsOut, 'and', icoOut);
}

main().catch((err) => {
  console.error('[build-icons] Error:', err?.message || err);
  process.exit(1);
});

