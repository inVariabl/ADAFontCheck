import { loadAdaAnalyzer, analyzeFont } from './wasm/adaAnalyzer.js';
import { loadAdaMetrics } from './wasm/adaMetrics.js';

const STANDARDS = {
  federal: {
    body: { min: 55, max: 110 },
    tactile: { min: 0, max: 15 },
    visual: { min: 10, max: 30 }
  },
  california: {
    body: { min: 60, max: 110 },
    tactile: { min: 0, max: 15 },
    visual: { min: 10, max: 20 }
  }
};

self.addEventListener('message', async (event) => {
  const { id, files } = event.data;

  try {
    await loadAdaAnalyzer();
    const adaMetrics = await loadAdaMetrics();
    const results = [];

    for (const file of files) {
      try {
        const analysis = await analyzeFont(file.buffer);
        if (analysis.error) {
          results.push({ fileName: file.name, error: analysis.error });
        } else {
          const bodyRatio = analysis.body.ratio;
          const strokeRatio = analysis.stroke.ratio;
          const sansSerif = analysis.test.sansSerif;
          const notitalic = analysis.test.notitalic;

          results.push({
            fileName: file.name,
            name: analysis.name,
            weight: analysis.weight,
            i: analysis.i,
            h: analysis.h,
            o: analysis.o,
            federal: STANDARDS.federal,
            california: STANDARDS.california,
            stroke: { ratio: strokeRatio },
            body: { ratio: bodyRatio },
            test: {
              notitalic,
              sansSerif,
              federal: {
                tactile: Boolean(adaMetrics.federal_tactile_pass(Number(sansSerif), Number(notitalic), bodyRatio, strokeRatio)),
                visual: Boolean(adaMetrics.federal_visual_pass(Number(sansSerif), Number(notitalic), bodyRatio, strokeRatio))
              },
              california: {
                tactile: Boolean(adaMetrics.california_tactile_pass(Number(sansSerif), Number(notitalic), bodyRatio, strokeRatio)),
                visual: Boolean(adaMetrics.california_visual_pass(Number(sansSerif), Number(notitalic), bodyRatio, strokeRatio))
              }
            }
          });
        }
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
