import { analyzeFont } from './wasm/adaAnalyzer.js';
import { loadAdaMetrics } from './wasm/adaMetrics.js';
import { deriveFontMetadataFromFilename } from './fontName.js';
import { analyzeFontWithOpenType } from './opentypeAnalyzer.js';

const adaMetricsPromise = loadAdaMetrics();

function looksEmpty(result) {
  return (
    !result ||
    !result.i ||
    !result.h ||
    !result.o ||
    result.i.commands.length === 0 ||
    result.h.commands.length === 0 ||
    result.o.commands.length === 0 ||
    (result.stroke.ratio === 0 && result.body.ratio === 0)
  );
}

function buildTestResult(adaMetrics, sansSerif, notitalic, bodyRatio, strokeRatio) {
  const sans = Number(sansSerif);
  const italic = Number(notitalic);
  return {
    notitalic,
    sansSerif,
    federal: {
      tactile: Boolean(adaMetrics.federal_tactile_pass(sans, italic, bodyRatio, strokeRatio)),
      visual: Boolean(adaMetrics.federal_visual_pass(sans, italic, bodyRatio, strokeRatio))
    },
    california: {
      tactile: Boolean(adaMetrics.california_tactile_pass(sans, italic, bodyRatio, strokeRatio)),
      visual: Boolean(adaMetrics.california_visual_pass(sans, italic, bodyRatio, strokeRatio))
    }
  };
}

self.addEventListener('message', async (event) => {
  const { id, files } = event.data;

  try {
    const adaMetrics = await adaMetricsPromise;
    const results = [];

    for (const file of files) {
      try {
        const analyzed = await analyzeFont(file.buffer);
        const result =
          analyzed.error || looksEmpty(analyzed)
            ? analyzeFontWithOpenType(file.buffer, file.name)
            : analyzed;

        const fallback = deriveFontMetadataFromFilename(file.name);
        const name = result.name && result.name !== 'Unknown Font' ? result.name : fallback.name;
        const weight = result.weight && result.weight !== 'Regular' ? result.weight : fallback.weight;

        results.push({
          fileName: file.name,
          name,
          weight,
          i: result.i,
          h: result.h,
          o: result.o,
          stroke: result.stroke,
          body: result.body,
          test: buildTestResult(
            adaMetrics,
            result.test.sansSerif,
            result.test.notitalic,
            result.body.ratio,
            result.stroke.ratio
          )
        });

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
