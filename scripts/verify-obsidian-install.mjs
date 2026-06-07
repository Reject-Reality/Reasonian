#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const defaultInstallDir = 'D:/Note/Note/.obsidian/plugins/reasonian';
const installDir = process.argv[2] ? resolve(process.argv[2]) : defaultInstallDir;

const requiredAssets = [
  'main.js',
  'styles.css',
  'manifest.json',
  'grammars/tree-sitter-typescript.wasm',
  'grammars/tree-sitter-tsx.wasm',
  'grammars/tree-sitter-javascript.wasm',
  'grammars/tree-sitter-python.wasm',
  'grammars/tree-sitter-go.wasm',
  'grammars/tree-sitter-rust.wasm',
  'grammars/tree-sitter-java.wasm',
  'grammars/web-tree-sitter.wasm',
];

const missing = [];
const empty = [];

for (const asset of requiredAssets) {
  const absolutePath = join(installDir, asset);
  if (!existsSync(absolutePath)) {
    missing.push(asset);
    continue;
  }

  if (statSync(absolutePath).size === 0) {
    empty.push(asset);
  }
}

if (missing.length > 0 || empty.length > 0) {
  if (missing.length > 0) {
    console.error(`Missing installed asset${missing.length === 1 ? '' : 's'} in ${installDir}:`);
    for (const asset of missing) {
      console.error(`- ${asset}`);
    }
  }

  if (empty.length > 0) {
    console.error(`Empty installed asset${empty.length === 1 ? '' : 's'} in ${installDir}:`);
    for (const asset of empty) {
      console.error(`- ${asset}`);
    }
  }

  process.exit(1);
}

const sourceManifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const installedManifest = JSON.parse(readFileSync(join(installDir, 'manifest.json'), 'utf8'));

if (installedManifest.id !== sourceManifest.id) {
  console.error(`Installed manifest id mismatch: expected "${sourceManifest.id}", got "${installedManifest.id}"`);
  process.exit(1);
}

if (installedManifest.version !== sourceManifest.version) {
  console.error(`Installed manifest version mismatch: expected "${sourceManifest.version}", got "${installedManifest.version}"`);
  process.exit(1);
}

console.log(`Verified installed Reasonian plugin at ${installDir}`);
console.log(`- manifest id: ${installedManifest.id}`);
console.log(`- manifest version: ${installedManifest.version}`);
console.log(`- assets checked: ${requiredAssets.length}`);
