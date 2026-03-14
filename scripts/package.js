#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Paths ---

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = join(root, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;
const stageDirectory = join(root, '.package-stage');
const outputFile = join(root, `pagequizzer-${version}.zip`);

const stagedFiles = [
  'manifest.json',
  'dist/background.js',
  'dist/content.js',
  'dist/panel.js',
  'dist/pdfjs.js',
  'dist/pdf.worker.js',
  'src/panel/panel.html',
  'src/panel/panel.css',
];

// --- Packaging ---

function main() {
  console.log('Building...');
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });

  resetArtifacts();
  mkdirSync(stageDirectory, { recursive: true });

  try {
    stageRuntimeFiles();
    createZip();
  } finally {
    rmSync(stageDirectory, { recursive: true, force: true });
  }

  reportPackage();
}

function resetArtifacts() {
  rmSync(stageDirectory, { recursive: true, force: true });
  rmSync(outputFile, { force: true });
}

function stageRuntimeFiles() {
  for (const file of stagedFiles) {
    copyIntoStage(file);
  }

  const iconsDirectory = join(root, 'icons');
  if (existsSync(iconsDirectory)) {
    cpSync(iconsDirectory, join(stageDirectory, 'icons'), { recursive: true });
  }
}

function copyIntoStage(relativePath) {
  const sourcePath = join(root, relativePath);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing required package file: ${relativePath}`);
  }

  const destinationPath = join(stageDirectory, relativePath);
  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath);
}

function createZip() {
  execFileSync('zip', ['-r', outputFile, '.'], { cwd: stageDirectory, stdio: 'inherit' });
}

function reportPackage() {
  const sizeBytes = statSync(outputFile).size;
  console.log(`\nPackaged: ${relative(root, outputFile)} (${(sizeBytes / 1024).toFixed(1)} KB)`);
}

main();
