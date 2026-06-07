#!/usr/bin/env node
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const defaultVaultDir = 'D:/Note/Reasonian-CleanVault';
const defaultObsidianConfig = 'C:/Users/29421/AppData/Roaming/obsidian/obsidian.json';

const vaultDir = process.argv[2] ? resolve(process.argv[2]) : defaultVaultDir;
const obsidianConfigPath = process.argv[3]
  ? resolve(process.argv[3])
  : defaultObsidianConfig;

if (!existsSync(vaultDir)) {
  console.error(`Vault does not exist: ${vaultDir}`);
  console.error('Run `npm run prepare:clean-vault` first.');
  process.exit(1);
}

const vaultId = createHash('sha256')
  .update(vaultDir.toLowerCase())
  .digest('hex')
  .slice(0, 16);

const configDir = dirname(obsidianConfigPath);
mkdirSync(configDir, { recursive: true });

let config = { vaults: {} };
if (existsSync(obsidianConfigPath)) {
  try {
    config = JSON.parse(readFileSync(obsidianConfigPath, 'utf8'));
  } catch {
    config = { vaults: {} };
  }
}

if (!config || typeof config !== 'object') {
  config = { vaults: {} };
}

if (!config.vaults || typeof config.vaults !== 'object') {
  config.vaults = {};
}

config.vaults[vaultId] = {
  path: vaultDir,
  ts: Date.now(),
  open: false,
};

writeFileSync(obsidianConfigPath, JSON.stringify(config, null, 2));

console.log(`Registered clean vault in Obsidian config: ${obsidianConfigPath}`);
console.log(`- vault id: ${vaultId}`);
console.log(`- vault path: ${vaultDir}`);
console.log('Manual step remaining: open this vault in Obsidian and confirm the Reasonian view loads.');
