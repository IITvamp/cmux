#!/usr/bin/env bun
// Cross-platform generation of Electron app icons for macOS, Windows, and Linux.
// - Reads the largest PNG from assets/cmux-logos/cmux.iconset as the source.
// - Produces build/icon.icns, build/icon.ico, and build/icon.png.

import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";

import png2icons from "png2icons";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectDir = resolve(__dirname, "..", "");
const assetsIconsetDir = resolve(projectDir, "assets", "cmux-logos", "cmux.iconset");
const buildDir = resolve(projectDir, "build");

const ensureDir = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true });
};

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const findLargestPng = async (dir: string): Promise<string> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const pngs = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => join(dir, entry.name));

  if (pngs.length === 0) {
    throw new Error(`No PNG files found in ${dir}`);
  }

  let largest = pngs[0];
  let largestSize = 0;
  for (const path of pngs) {
    const details = await stat(path);
    if (details.size > largestSize) {
      largest = path;
      largestSize = details.size;
    }
  }

  return largest;
};

const main = async (): Promise<void> => {
  await ensureDir(buildDir);

  const icnsPath = join(buildDir, "icon.icns");
  const icoPath = join(buildDir, "icon.ico");
  const pngPath = join(buildDir, "icon.png");

  const alreadyPresent =
    (await fileExists(icnsPath)) && (await fileExists(icoPath)) && (await fileExists(pngPath));
  if (alreadyPresent) {
    console.log("icons: already present; skipping generation");
    return;
  }

  const sourcePngPath = await findLargestPng(assetsIconsetDir);
  const sourceBuffer = await readFile(sourcePngPath);

  if (!(await fileExists(icnsPath))) {
    const icns = png2icons.createICNS(sourceBuffer, png2icons.BICUBIC, 0, false);
    if (!icns || icns.length === 0) {
      throw new Error("Failed to generate ICNS icon");
    }
    await writeFile(icnsPath, icns);
    console.log(`icons: wrote ${relative(projectDir, icnsPath)}`);
  }

  if (!(await fileExists(icoPath))) {
    const ico = png2icons.createICO(sourceBuffer, png2icons.BICUBIC, 0, false);
    if (!ico || ico.length === 0) {
      throw new Error("Failed to generate ICO icon");
    }
    await writeFile(icoPath, ico);
    console.log(`icons: wrote ${relative(projectDir, icoPath)}`);
  }

  if (!(await fileExists(pngPath))) {
    const preferred512 = join(assetsIconsetDir, "icon_512x512.png");
    const pngSource = (await fileExists(preferred512)) ? preferred512 : sourcePngPath;
    const pngBuffer = await readFile(pngSource);
    await writeFile(pngPath, pngBuffer);
    console.log(`icons: wrote ${relative(projectDir, pngPath)}`);
  }
};

main().catch((error) => {
  console.error("icons: generation failed", error);
  process.exit(1);
});
