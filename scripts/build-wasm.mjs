import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const wasmDir = resolve('src/wasm');
const outDir = resolve('src/lib/wasm');
mkdirSync(outDir, { recursive: true });

function compile(input, output, exports) {
  const args = [
    '--target=wasm32',
    '-O3',
    '-nostdlib',
    '-fno-stack-protector',
    `-I${wasmDir}`,
    '-Wl,--no-entry',
    '-Wl,--initial-memory=12582912',
    ...exports.map((e) => `-Wl,--export=${e}`),
    '-Wl,--allow-undefined',
    '-o', output,
    input
  ];

  const result = spawnSync('clang', args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

compile(
  resolve('src/wasm/ada_metrics.c'),
  resolve('src/lib/wasm/ada_metrics.wasm'),
  ['ratio_percent', 'average_percent', 'in_range', 'standards_pass',
   'federal_tactile_pass', 'federal_visual_pass',
   'california_tactile_pass', 'california_visual_pass']
);

compile(
  resolve('src/wasm/ada_analyzer.c'),
  resolve('src/lib/wasm/ada_analyzer.wasm'),
  ['analyze_font', 'get_font_ptr', 'get_result_ptr',
   'prepare_instances', 'get_instance_name_ptr', 'fill_instance_name',
   'analyze_font_instance']
);
