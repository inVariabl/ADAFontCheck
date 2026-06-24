import wasmUrl from './ada_metrics.wasm?url';

let metricsPromise;

export function loadAdaMetrics() {
  metricsPromise ??= WebAssembly.instantiateStreaming(fetch(wasmUrl), {}).then(
    ({ instance }) => instance.exports
  );
  return metricsPromise;
}
