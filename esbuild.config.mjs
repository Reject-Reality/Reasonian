import esbuild from 'esbuild';
import path from 'path';
import process from 'process';
// Node.js built-in modules (replaces 'builtin-modules' package per Obsidian review feedback)
const BUILTIN_MODULES = [
  'assert','assert/strict','async_hooks','buffer','child_process','cluster','console','constants',
  'crypto','dgram','diagnostics_channel','dns','dns/promises','domain','events','fs','fs/promises',
  'http','http2','https','inspector','inspector/promises','module','net','os','path','path/posix',
  'path/win32','perf_hooks','process','punycode','querystring','readline','readline/promises',
  'repl','stream','stream/consumers','stream/promises','stream/web','string_decoder','sys','timers',
  'timers/promises','tls','trace_events','tty','url','util','util/types','v8','vm','wasi','worker_threads',
  'zlib',
];

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  promises as fsPromises,
  readFileSync,
  rmSync,
} from 'fs';


// Load .env.local if it exists
if (existsSync('.env.local')) {
  const envContent = readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=["']?(.+?)["']?$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

const prod = process.argv[2] === 'production';
const REASONIX_ROOT = path.resolve('..', 'DeepSeek-Reasonix');
const REASONIX_GRAMMAR_SOURCES = [
  [path.join(REASONIX_ROOT, 'node_modules', 'tree-sitter-typescript', 'tree-sitter-typescript.wasm'), 'tree-sitter-typescript.wasm'],
  [path.join(REASONIX_ROOT, 'node_modules', 'tree-sitter-typescript', 'tree-sitter-tsx.wasm'), 'tree-sitter-tsx.wasm'],
  [path.join(REASONIX_ROOT, 'node_modules', 'tree-sitter-javascript', 'tree-sitter-javascript.wasm'), 'tree-sitter-javascript.wasm'],
  [path.join(REASONIX_ROOT, 'node_modules', 'tree-sitter-python', 'tree-sitter-python.wasm'), 'tree-sitter-python.wasm'],
  [path.join(REASONIX_ROOT, 'node_modules', 'tree-sitter-go', 'tree-sitter-go.wasm'), 'tree-sitter-go.wasm'],
  [path.join(REASONIX_ROOT, 'node_modules', 'tree-sitter-rust', 'tree-sitter-rust.wasm'), 'tree-sitter-rust.wasm'],
  [path.join(REASONIX_ROOT, 'node_modules', 'tree-sitter-java', 'tree-sitter-java.wasm'), 'tree-sitter-java.wasm'],
  [path.join(REASONIX_ROOT, 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm'), 'web-tree-sitter.wasm'],
];

function copyReasonixGrammars(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const [source, filename] of REASONIX_GRAMMAR_SOURCES) {
    if (!existsSync(source)) {
      console.warn(`Reasonix grammar asset missing: ${source}`);
      continue;
    }
    copyFileSync(source, path.join(targetDir, filename));
  }
}

const patchReasonixImportMeta = {
  name: 'patch-reasonix-import-meta',
  setup(build) {
    // Match all reasonix dist files
    build.onLoad(
      { filter: /[\\/]DeepSeek-Reasonix[\\/]dist[\\/].*\.js$/ },
      async (args) => {
        let contents = await fsPromises.readFile(args.path, 'utf8');
        // Replace `globalThis.require = __cr(import.meta.url)` with a no-op
        // — we don't need createRequire in the bundled context.
        contents = contents.replace(
          /globalThis\.require\s*=\s*__cr\(import\.meta\.url\)/g,
          '/* patched: no createRequire in bundled context */ 0',
        );
        // Replace other import.meta.url usages with a CJS-compatible shim
        contents = contents.replace(
          /import\.meta\.url/g,
          '(typeof __filename !== "undefined" ? require("url").pathToFileURL(__filename).href : "file:///plugin/main.js")',
        );
        return {
          contents,
          loader: 'js',
        };
      },
    );
  },
};



// Obsidian plugin folder path (set via OBSIDIAN_VAULT env var or .env.local)
const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT;
const OBSIDIAN_PLUGIN_PATH = OBSIDIAN_VAULT && existsSync(OBSIDIAN_VAULT)
  ? path.join(OBSIDIAN_VAULT, '.obsidian', 'plugins', 'reasonian')
  : null;

// Plugin to copy built files to Obsidian plugin folder
const copyToObsidian = {
  name: 'copy-to-obsidian',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return;
      if (!OBSIDIAN_PLUGIN_PATH) return;

      if (!existsSync(OBSIDIAN_PLUGIN_PATH)) {
        mkdirSync(OBSIDIAN_PLUGIN_PATH, { recursive: true });
      }

      const files = ['main.js', 'manifest.json', 'styles.css'];
      for (const file of files) {
        if (existsSync(file)) {
          copyFileSync(file, path.join(OBSIDIAN_PLUGIN_PATH, file));
          console.log(`Copied ${file} to Obsidian plugin folder`);
        }
      }

      // Reasonix JavaScript is bundled in main.js; tree-sitter needs wasm assets.
      copyReasonixGrammars(path.join(OBSIDIAN_PLUGIN_PATH, 'grammars'));
      console.log('Copied Reasonix grammar assets to Obsidian plugin folder');
    });
  }
};

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  plugins: [patchReasonixImportMeta, copyToObsidian],
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...BUILTIN_MODULES,
    ...BUILTIN_MODULES.map(m => `node:${m}`),
  ],
  format: 'cjs',
  target: 'es2022',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
