import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const input = resolve('src/wasm/ada_metrics.c');
const output = resolve('src/lib/wasm/ada_metrics.wasm');

mkdirSync(dirname(output), { recursive: true });

const args = [
  '--target=wasm32',
  '-O3',
  '-nostdlib',
  '-Wl,--no-entry',
  '-Wl,--export=ratio_percent',
  '-Wl,--export=average_percent',
  '-Wl,--export=in_range',
  '-Wl,--export=standards_pass',
  '-Wl,--export=federal_tactile_pass',
  '-Wl,--export=federal_visual_pass',
  '-Wl,--export=california_tactile_pass',
  '-Wl,--export=california_visual_pass',
  '-Wl,--allow-undefined',
  '-o',
  output,
  input
];

const result = spawnSync('clang', args, { stdio: 'inherit' });

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
