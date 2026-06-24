# SvelteKit + Web Worker + C WASM Plan

## Goal

Move ADAFontCheck to a SvelteKit app where font uploads are processed in a Web Worker and ADA numeric threshold checks run through a small C module compiled to WebAssembly.

## Architecture

1. SvelteKit owns the app shell, upload controls, results table, CSV export, glyph inspector, print report, and static deployment output.
2. A dedicated Web Worker receives uploaded font `ArrayBuffer`s, parses them with `opentype.js`, extracts glyph metrics, and returns serializable results.
3. C WASM provides deterministic numeric helpers for ratios, averages, range checks, and the four ADA compliance decisions.
4. Static media stays in `media/`; SvelteKit serves it from `static/media/`.

## Implementation Steps

1. Add SvelteKit/Vite project files and npm scripts.
2. Add a C source file for ratio and compliance calculations.
3. Add a Node build script that compiles C to `src/lib/wasm/ada_metrics.wasm` using local `clang`.
4. Convert the font metric logic into a worker-friendly ES module.
5. Build the Svelte page with upload, processing status, compact/dark controls, CSV export, glyph inspector, and print report.
6. Update README usage for the new SvelteKit branch.
7. Verify with `npm install`, WASM build, Svelte check, and production build.

## Notes

- `opentype.js` remains responsible for OpenType parsing and glyph path extraction.
- The worker keeps expensive parsing off the UI thread.
- The C WASM boundary is deliberately narrow so browser integration stays simple and testable.
