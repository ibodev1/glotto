import { build, emptyDir } from '@deno/dnt';
import denoJson from '../deno.json' with { type: 'json' };
import { resolvePath } from '../src/file.ts';

const NPM_DIR = resolvePath('./npm');

const LICENCE_DIR = resolvePath('./LICENSE');
const README_DIR = resolvePath('./README.md');
const SCHEMA_SRC = resolvePath('./schema/glotto.schema.json');
const NEW_LICENCE_DIR = resolvePath('./npm/LICENSE');
const NEW_README_DIR = resolvePath('./npm/README.md');
const NEW_SCHEMA_DIR = resolvePath('./npm/schema');
const NEW_SCHEMA_FILE = resolvePath('./npm/schema/glotto.schema.json');

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
    description: 'AI-powered i18n JSON translator. Multi-target, incremental, provider-agnostic (OpenAI, Anthropic, Gemini).',
    author: 'Ibrahim Odev <me@ibrahimo.dev>',
    license: 'MIT',
    keywords: [
      'i18n',
      'translation',
      'translator',
      'ai',
      'openai',
      'anthropic',
      'gemini',
      'localization',
      'l10n',
      'json',
      'cli',
    ],
    homepage: 'https://github.com/ibodev1/glotto#readme',
    publishConfig: {
      access: 'public',
    },
    engines: {
      node: '>=20.10.0',
    },
    repository: {
      type: 'git',
      url: 'git+https://github.com/ibodev1/glotto.git',
    },
    bugs: {
      url: 'https://github.com/ibodev1/glotto/issues',
    },
    dependencies: {
      '@google/genai': '^2.0.0',
      'openai': '^6.37.0',
      '@anthropic-ai/sdk': '^0.95.1',
      'consola': '^3.4.2',
    },
  },
  postBuild() {
    Deno.copyFileSync(LICENCE_DIR, NEW_LICENCE_DIR);
    Deno.copyFileSync(README_DIR, NEW_README_DIR);
    Deno.mkdirSync(NEW_SCHEMA_DIR, { recursive: true });
    Deno.copyFileSync(SCHEMA_SRC, NEW_SCHEMA_FILE);
  },
});
