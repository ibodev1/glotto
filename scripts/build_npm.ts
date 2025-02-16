import { build, emptyDir } from '@deno/dnt';
import denoJson from '../deno.json' with { type: 'json' };
import { resolvePath } from '../src/file.ts';

const CLI_DIR = resolvePath('./cli.ts');
const NPM_dIR = resolvePath('./npm');

const LICENCE_DIR = resolvePath('./LICENSE');
const README_DIR = resolvePath('./README.md');
const NEW_LICENCE_DIR = resolvePath('./npm/LICENSE');
const NEW_README_DIR = resolvePath('./npm/README.md');

await emptyDir(NPM_dIR);

await build({
  entryPoints: [CLI_DIR],
  outDir: NPM_dIR,
  shims: {
    deno: true,
  },
  test: false,
  typeCheck: false,
  importMap: 'deno.json',
  package: {
    name: 'glotto',
    version: denoJson.version,
    description: 'A tool for translating i18n JSON files using AI services.',
    author: 'Ibrahim Odev <developer.ibrahimodev@gmail.com>',
    license: 'MIT',
    engines: {
      'node': '>=20.0.0',
      'npm': '>=8.12.1',
    },
    files: [
      'npm',
    ],
    main: 'esm/cli.js',
    types: 'esm/cli.d.ts',
    bin: {
      glotto: 'esm/cli.js',
    },
    repository: {
      type: 'git',
      url: 'git+https://github.com/ibodev1/glotto.git',
    },
    bugs: {
      url: 'https://github.com/ibodev1/glotto/issues',
    },
    dependencies: {
      '@google/generative-ai': '^0.21.0',
      'consola': '^3.4.0',
    },
    devDependencies: {
      '@types/node': '^16',
    },
  },
  postBuild() {
    Deno.copyFileSync(LICENCE_DIR, NEW_LICENCE_DIR);
    Deno.copyFileSync(README_DIR, NEW_README_DIR);
  },
});
