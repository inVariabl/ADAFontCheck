# SvelteKit + Web Worker + C WASM Plan

## Goal

Move ADAFontCheck to a SvelteKit app where font uploads are processed in a Web Worker and all font parsing, glyph metric extraction, and ADA compliance checks run through C compiled to WebAssembly. Eliminate the opentype.js JavaScript dependency entirely.

## Architecture

1. SvelteKit owns the app shell, upload controls, results table, CSV export, glyph inspector, print report, and static deployment output.
2. A dedicated Web Worker receives uploaded font `ArrayBuffer`s, copies them into shared WASM linear memory, and calls C functions to parse the font, extract glyph metrics, detect serif/italic, and compute compliance results.
3. Two C WASM modules serve distinct roles:
   - **`ada_metrics.c`** — deterministic numeric helpers for ratios, averages, range checks, and the four ADA compliance decisions (Federal/California × Tactile/Visual).
   - **`ada_analyzer.c`** — full OpenType/TrueType font parsing via `stb_truetype.h`, glyph vertex extraction for I/H/O, sans-serif classification, italic detection, and serialization of path commands for the glyph inspector canvas renderer.
4. Static media stays in `media/`; SvelteKit serves it from `static/media/`.

## Implementation Steps

### Step 1: Extend `ada_analyzer.c` — store glyph vertex data

- Increase `RESULT_SIZE` from 4096 to 8192 to accommodate vertex command data.
- After extracting metrics for each glyph (I/H/O), store the `stbtt_vertex` arrays (type, x, y, cx, cy, cx1, cy1) into the result buffer.
- No new WASM exports needed; the existing `get_result_ptr` export provides access.

### Step 2: Update `adaAnalyzer.js` — read vertex data, build commands

- Add offset constants for vertex data sections in the result buffer.
- Convert `stbtt_vertex` data to canvas-compatible command objects:

| stbtt_vertex type | Canvas command |
|---|---|
| `STBTT_vmove` (1) | `M(x, y)` |
| `STBTT_vline` (2) | `L(x, y)` |
| `STBTT_vcurve` (3) | `Q(cx, cy, x, y)` |
| `STBTT_vcubic` (4) | `C(cx1, cy1, cx, cy, x, y)` |

- Import `loadAdaMetrics` and call it once in the worker to run the four compliance checks (federal/california × tactile/visual) against the extracted ratios.
- Return a result shape matching what the Svelte page expects (`name`, `weight`, `i`/`h`/`o` glyph objects with `commands`, `test` object with compliance results, etc.).

### Step 3: Rewrite `fontWorker.js` — use C analyzer exclusively

- Load both `adaMetrics` and `adaAnalyzer` WASM modules on worker start.
- For each file:
  1. Copy the `ArrayBuffer` into WASM memory via the `get_font_ptr` export.
  2. Call `analyze_font(data_size)`.
  3. Read the structured result from `get_result_ptr`.
  4. Call `adaMetrics` compliance functions with extracted body/stroke ratios.
  5. Apply filename-derived fallback for name/weight via `fontName.js` (thin JS wrapper, not opentype.js).
- Remove the `import { parse } from 'opentype.js'` — this is the core elimination.

### Step 4: Update `+page.svelte` — remove opentype.js from glyph inspector

- Remove `import { parse } from 'opentype.js'`.
- Remove the `showInspector()` function that re-parsed fonts with opentype.js — commands are already present in the result from the worker.
- Remove the `fontBuffers` map (only used by the old inspector).
- `drawGlyph()` and `drawSelectedGlyphs()` work unchanged — they already use `metrics.commands`.

### Step 5: Remove opentype.js from dependencies

- `npm uninstall opentype.js`
- Remove from `package.json`.

### Step 6: Clean up obsolete files

- Delete `src/lib/fontAnalyzer.js` (all logic moved to C + thin worker adapter).
- Delete `src/checkfont.js`, `src/index.js`, `src/style.css` (legacy v1 code superseded by SvelteKit).
- Delete `src/index.html` (legacy v1 single-page app).
- Keep `src/checkfont_node.js` if the Node.js CLI use case is still valued (separate tool).
- Keep `src/lib/fontName.js` (used in worker for filename-derived name/weight fallback).

### Step 7: Update build artifacts

- Run `npm run wasm` to recompile both `.c` files.
- Run `npm run build` to produce the static site.
- Verify with `svelte-check`.

## Notes

- `stb_truetype.h` provides all OpenType/TrueType parsing in C — no JavaScript font parsing library remains.
- The WASM boundary stays simple: font data is copied into linear memory, C functions operate on it, and structured results are read back through a fixed-size result buffer.
- The Web Worker keeps all font processing off the UI thread, even with WASM overhead.
- `fontName.js` (filename-based metadata fallback) remains as a trivial JS utility — it does not parse the font binary.
