import { build, emptyDir } from '@deno/dnt';
import denoJson from '../deno.json' with { type: 'json' };
import { resolvePath } from '../src/file.ts';

const NPM_DIR = resolvePath('./npm');

const LICENCE_DIR = resolvePath('./LICENSE');
const README_DIR = resolvePath('./README.md');
const NEW_LICENCE_DIR = resolvePath('./npm/LICENSE');
const NEW_README_DIR = resolvePath('./npm/README.md');

await emptyDir(NPM_DIR);

await build({
  entryPoints: [
    {
      kind: 'bin',
      name: 'glotto',
      path: './cli.ts',
    },
  ],
  outDir: NPM_DIR,
  shims: {
    deno: true,
  },
  test: false,
  typeCheck: false,
  packageManager: 'npm',
  package: {
    name: 'glotto',
    version: denoJson.version,
    description: 'A tool for translating i18n JSON files using AI services.',
    author: 'Ibrahim Odev <me@ibrahimo.dev>',
    license: 'MIT',
    publishConfig: {
      'access': 'public',
    },
    engines: {
      'node': '>=20.0.0',
    },
    repository: {
      type: 'git',
      url: 'git+https://github.com/ibodev1/glotto.git',
    },
    bugs: {
      url: 'https://github.com/ibodev1/glotto/issues',
    },
    dependencies: {
      '@google/genai': '^1.41.0',
      '@openai/openai': '^6.21.0',
      '@anthropic-ai/sdk': '^0.74.0',
      'consola': '^3.4.2',
    },
  },
  postBuild() {
    Deno.copyFileSync(LICENCE_DIR, NEW_LICENCE_DIR);
    Deno.copyFileSync(README_DIR, NEW_README_DIR);
  },
});
