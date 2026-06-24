import { analyzeFontFile } from './fontAnalyzer.js';
import { loadAdaMetrics } from './wasm/adaMetrics.js';

self.addEventListener('message', async (event) => {
  const { id, files } = event.data;

  try {
    const adaMetrics = await loadAdaMetrics();
    const results = [];

    for (const file of files) {
      try {
        results.push(await analyzeFontFile(file, adaMetrics));
        self.postMessage({ id, type: 'progress', processed: results.length, total: files.length });
      } catch (error) {
        results.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    self.postMessage({ id, type: 'complete', results });
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
