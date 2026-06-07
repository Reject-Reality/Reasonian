#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const defaultVaultDir = 'D:/Note/Reasonian-CleanVault';
const defaultSourcePluginDir = resolve(ROOT);

const vaultDir = process.argv[2] ? resolve(process.argv[2]) : defaultVaultDir;
const sourcePluginDir = process.argv[3] ? resolve(process.argv[3]) : defaultSourcePluginDir;
const pluginId = 'reasonian';

const obsidianDir = join(vaultDir, '.obsidian');
const pluginDir = join(obsidianDir, 'plugins', pluginId);

const requiredPluginAssets = [
  'main.js',
  'styles.css',
  'manifest.json',
  'grammars',
];

for (const asset of requiredPluginAssets) {
  const assetPath = join(sourcePluginDir, asset);
  if (!existsSync(assetPath)) {
    console.error(`Missing plugin asset in source directory: ${assetPath}`);
    process.exit(1);
  }
}

rmSync(vaultDir, { recursive: true, force: true });
mkdirSync(pluginDir, { recursive: true });

for (const asset of requiredPluginAssets) {
  const source = join(sourcePluginDir, asset);
  const target = join(pluginDir, asset);
  cpSync(source, target, { recursive: true, force: true });
}

const appConfig = {
  readableLineLength: true,
  promptDelete: false,
  spellcheck: false,
};

const communityPlugins = [pluginId];

writeFileSync(join(obsidianDir, 'app.json'), JSON.stringify(appConfig, null, 2));
writeFileSync(join(obsidianDir, 'community-plugins.json'), JSON.stringify(communityPlugins, null, 2));
writeFileSync(join(obsidianDir, 'core-plugins.json'), JSON.stringify([], null, 2));

const installedManifest = JSON.parse(
  readFileSync(join(pluginDir, 'manifest.json'), 'utf8'),
);

console.log(`Prepared clean vault at ${vaultDir}`);
console.log(`- plugin: ${installedManifest.id}@${installedManifest.version}`);
console.log(`- plugin dir: ${pluginDir}`);
console.log(`- community plugins: ${communityPlugins.join(', ')}`);
console.log('Manual step remaining: open this vault in Obsidian and confirm the Reasonian view loads.');
