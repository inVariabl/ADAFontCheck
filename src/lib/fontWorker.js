import { analyzeFont } from './wasm/adaAnalyzer.js';
import { loadAdaMetrics } from './wasm/adaMetrics.js';
import { deriveFontMetadataFromFilename } from './fontName.js';
import { analyzeFontWithOpenType } from './opentypeAnalyzer.js';

if (typeof globalThis.crypto?.randomUUID !== 'function') {
  const g = globalThis;
  if (!g.crypto) g.crypto = {};
  g.crypto.randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

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

let totalWasmTime = 0;
let totalFallbackTime = 0;
let totalFonts = 0;
let fallbackCount = 0;

function buildResult(metrics, fileName, adaMetrics) {
  const needsNameFallback = !metrics.name || metrics.name === 'Unknown Font';
  const needsWeightFallback = !metrics.weight || metrics.weight === 'Regular';
  const fallback = (needsNameFallback || needsWeightFallback) ? deriveFontMetadataFromFilename(fileName) : null;
  return {
    fileName,
    name: needsNameFallback && fallback ? fallback.name : metrics.name,
    weight: needsWeightFallback && fallback ? fallback.weight : metrics.weight,
    i: metrics.i, h: metrics.h, o: metrics.o,
    stroke: metrics.stroke, body: metrics.body,
    test: buildTestResult(adaMetrics, metrics.test.sansSerif, metrics.test.notitalic, metrics.body.ratio, metrics.stroke.ratio)
  };
}

async function analyzeOneFile(file, adaMetrics) {
  const t0 = performance.now();
  const analyzed = await analyzeFont(file.buffer);
  const wasmTime = performance.now() - t0;
  totalWasmTime += wasmTime;
  totalFonts++;

  const needsFallback = analyzed.error || looksEmpty(analyzed);
  if (needsFallback) {
    const t1 = performance.now();
    const fallbackResult = analyzeFontWithOpenType(file.buffer, file.name);
    totalFallbackTime += performance.now() - t1;
    fallbackCount++;
    return buildResult(fallbackResult, file.name, adaMetrics);
  }

  return buildResult(analyzed, file.name, adaMetrics);
}

self.addEventListener('message', async (event) => {
  const { id, files, done } = event.data;

  if (done) {
    if (totalFonts > 0) {
      console.log(
        `[Worker] ${totalFonts} fonts: WASM avg ${(totalWasmTime / totalFonts).toFixed(2)}ms, ` +
        `fallback ${fallbackCount} fonts avg ${fallbackCount > 0 ? (totalFallbackTime / fallbackCount).toFixed(2) : 0}ms`
      );
    }
    self.postMessage({ id, type: 'done' });
    return;
  }

  try {
    const adaMetrics = await adaMetricsPromise;
    const results = [];

    for (const file of files) {
      try {
        results.push(await analyzeOneFile(file, adaMetrics));
      } catch (error) {
        results.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    self.postMessage({ id, type: 'result', results });
  } catch (error) {
    self.postMessage({
      id,
      type: 'result',
      results: files.map(f => ({
        fileName: f.name,
        error: error instanceof Error ? error.message : String(error)
      }))
    });
  }
});
