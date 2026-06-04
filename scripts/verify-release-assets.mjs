#!/usr/bin/env node
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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
  const absolutePath = join(ROOT, asset);
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
    console.error(`Missing release asset${missing.length === 1 ? '' : 's'}:`);
    for (const asset of missing) {
      console.error(`- ${asset}`);
    }
  }

  if (empty.length > 0) {
    console.error(`Empty release asset${empty.length === 1 ? '' : 's'}:`);
    for (const asset of empty) {
      console.error(`- ${asset}`);
    }
  }

  process.exit(1);
}

console.log(`Verified ${requiredAssets.length} release assets.`);
