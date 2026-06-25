<script>
  import { onDestroy } from 'svelte';
  import { downloadResultsCsv } from '$lib/csv.js';
  import '../../dist/style.css';
  import './styles.css';

  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    const g = globalThis;
    if (!g.crypto) g.crypto = {};
    g.crypto.randomUUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
  }

  const columns = [
    {
      label: 'Federal Tactile',
      body: '55% - 110%',
      stroke: '0% - 15%',
      region: 'federal',
      get: (result) => result.test.federal.tactile
    },
    {
      label: 'Federal Visual',
      body: '55% - 110%',
      stroke: '10% - 30%',
      region: 'federal',
      get: (result) => result.test.federal.visual
    },
    {
      label: 'California Tactile',
      body: '60% - 110%',
      stroke: '0% - 15%',
      region: 'california',
      get: (result) => result.test.california.tactile
    },
    {
      label: 'California Visual',
      body: '60% - 110%',
      stroke: '10% - 20%',
      region: 'california',
      get: (result) => result.test.california.visual
    }
  ];

  const passIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6" style="color: green;"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" /></svg>`;
  const failIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>`;
  const inspectIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="font-inspector-icon" aria-hidden="true"><path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 4.24 11.998l4.256 4.256a.75.75 0 1 0 1.06-1.06l-4.255-4.256A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" clip-rule="evenodd" /></svg>`;

  let activeWorkers = [];
  let requestId = 0;
  let results = [];
  let errors = [];
  let processed = 0;
  let total = 0;
  let processing = false;
  let compact = false;
  let darkMode = false;
  let selected = null;
  let visualizeOpen = false;
  let canvasI;
  let canvasH;
  let canvasO;

  $: if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = darkMode ? 'black' : 'emerald';
  }
  $: if (!visualizeOpen) {
    selected = null;
  }

  $: if (selected && visualizeOpen) {
    queueMicrotask(() => drawSelectedGlyphs());
  }

  async function handleFiles(event) {
    if (processing) return;

    const files = Array.from(event.currentTarget.files ?? []).filter((file) =>
      /\.(otf|ttf|woff|woff2)$/i.test(file.name) && !/^\._/i.test(file.name)
    );
    event.currentTarget.value = '';

    if (files.length) {
      await processFiles(files);
    }
  }

  async function processFiles(files) {
    if (processing) return;

    processing = true;
    processed = 0;
    total = files.length;
    results = [];
    errors = [];
    selected = null;
    visualizeOpen = false;

    const id = (requestId += 1);
    const fileArray = Array.from(files);
    const numWorkers = navigator.hardwareConcurrency || 4;
    const BATCH_SIZE = 300;
    const MINI_BATCH = 6;
    const tStart = performance.now();
    let readTime = 0;
    let workers = [];

    try {
      for (let i = 0; i < numWorkers; i++) {
        workers.push(
          new Worker(new URL('$lib/fontWorker.js', import.meta.url), { type: 'module' })
        );
      }
      activeWorkers = workers;

      const allFileResults = [];
      let currentQueue = [];
      let batchActiveCount = 0;
      let batchResolve = null;

      const readBatch = (start) => {
        const t = performance.now();
        const batch = fileArray.slice(start, start + BATCH_SIZE);
        return Promise.all(
          batch.map(async (file) => ({
            name: file.name,
            buffer: await file.arrayBuffer()
          }))
        ).then(data => {
          readTime += performance.now() - t;
          return data;
        });
      };

      for (let wi = 0; wi < numWorkers; wi++) {
        workers[wi].onmessage = (event) => {
          if (event.data.id !== id) return;
          if (event.data.type !== 'result') return;

          const results = event.data.results;
          for (let i = 0; i < results.length; i++) {
            allFileResults.push(results[i]);
          }
          processed = allFileResults.length;
          batchActiveCount--;

          if (currentQueue.length > 0) {
            const mb = currentQueue.shift();
            batchActiveCount++;
            workers[wi].postMessage({ id, files: mb }, mb.map(f => f.buffer));
          } else if (batchActiveCount === 0 && batchResolve) {
            batchResolve();
          }
        };
      }

      let nextBatchPromise = readBatch(0);

      for (let batchStart = 0; batchStart < fileArray.length; batchStart += BATCH_SIZE) {
        const batchData = await nextBatchPromise;

        const nextBatchStart = batchStart + BATCH_SIZE;
        if (nextBatchStart < fileArray.length) {
          nextBatchPromise = readBatch(nextBatchStart);
        } else {
          nextBatchPromise = null;
        }

        const miniBatches = [];
        for (let i = 0; i < batchData.length; i += MINI_BATCH) {
          miniBatches.push(batchData.slice(i, i + MINI_BATCH));
        }

        await new Promise((resolve) => {
          currentQueue = [...miniBatches];
          batchActiveCount = 0;
          batchResolve = resolve;

          for (let wi = 0; wi < numWorkers; wi++) {
            if (currentQueue.length > 0) {
              const mb = currentQueue.shift();
              batchActiveCount++;
              workers[wi].postMessage({ id, files: mb }, mb.map(f => f.buffer));
            }
          }

          if (batchActiveCount === 0) resolve();
        });
      }

      let workersDone = 0;
      await new Promise((resolve) => {
        for (let wi = 0; wi < numWorkers; wi++) {
          workers[wi].onmessage = (event) => {
            if (event.data.id !== id) return;
            if (event.data.type === 'done') {
              workersDone++;
              if (workersDone === numWorkers) resolve();
            }
          };
          workers[wi].postMessage({ id, done: true });
        }
      });

      const elapsed = performance.now() - tStart;
      console.log(
        `[Main] ${fileArray.length} fonts in ${(elapsed / 1000).toFixed(2)}s ` +
        `(read: ${(readTime / 1000).toFixed(2)}s, workers: ${numWorkers}, mini-batch: ${MINI_BATCH})`
      );

      results = allFileResults;
      errors = results.filter((result) => result.error);
    } finally {
      processing = false;
      for (const w of workers) w.terminate();
      activeWorkers = [];
    }
  }

  function clearFonts() {
    results = [];
    errors = [];
    processed = 0;
    total = 0;
    selected = null;
    visualizeOpen = false;
  }

  function showVisualization(result) {
    if (result.error) return;
    selected = result;
    visualizeOpen = true;
  }

  function closeVisualization() {
    visualizeOpen = false;
    selected = null;
  }

  function iconResults(test) {
    return test ? passIcon : failIcon;
  }

  function colorResults(test) {
    return test ? 'text-success' : 'text-error';
  }

  function passFail(test) {
    return test ? 'Pass' : 'Fail';
  }

  function ratio(value) {
    return Number.isFinite(value) ? `${value.toFixed(2)}%` : 'N/A';
  }

  function drawSelectedGlyphs() {
    if (!selected) return;
    drawGlyph(canvasI, 'I', selected.i);
    drawGlyph(canvasH, 'H', selected.h);
    drawGlyph(canvasO, 'O', selected.o);
  }

  function drawGlyph(canvas, char, metrics) {
    if (!canvas || !metrics) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 400;
    const height = canvas.clientHeight || 400;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    drawGrid(ctx, width, height);

    const xs = metrics.x?.length ? metrics.x : metrics.commands.map((command) => command.x).filter(Number.isFinite);
    const ys = metrics.y?.length ? metrics.y : metrics.commands.map((command) => command.y).filter(Number.isFinite);
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX === maxX) {
      minX = 0;
      maxX = 100;
    }
    if (!Number.isFinite(minY) || !Number.isFinite(maxY) || minY === maxY) {
      minY = 0;
      maxY = 100;
    }

    const glyphWidth = maxX - minX || 10;
    const glyphHeight = maxY - minY || 10;
    const cx = minX + glyphWidth / 2;
    const cy = minY + glyphHeight / 2;
    const padding = 60;
    const scale = Math.min((width - padding) / glyphWidth, (height - padding) / glyphHeight, 20);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    ctx.beginPath();
    for (const command of metrics.commands) {
      if (command.type === 'M') ctx.moveTo(command.x, command.y);
      else if (command.type === 'L') ctx.lineTo(command.x, command.y);
      else if (command.type === 'C') ctx.bezierCurveTo(command.x1 ?? command.cx1, command.y1 ?? command.cy1, command.x2 ?? command.cx, command.y2 ?? command.cy, command.x, command.y);
      else if (command.type === 'Q') ctx.quadraticCurveTo(command.x1 ?? command.cx, command.y1 ?? command.cy, command.x, command.y);
      else if (command.type === 'Z') ctx.closePath();
    }
    ctx.fillStyle = 'rgba(55, 65, 81, 0.2)';
    ctx.fill();
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = '#374151';
    ctx.stroke();

    if (glyphHeight > 0) {
      if (char === 'I') {
        drawGuides(ctx, cx, cy, glyphHeight, 0.1, 0.3, scale);
      } else {
        drawGuides(ctx, cx, cy, glyphHeight, 0.6, 1.1, scale);
      }
    }

    ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
    ctx.lineWidth = 2 / scale;
    for (const x of metrics.x ?? []) {
      ctx.beginPath();
      ctx.moveTo(x, cy - glyphHeight / 2 - 20 / scale);
      ctx.lineTo(x, cy + glyphHeight / 2 + 20 / scale);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    for (const y of metrics.y ?? []) {
      ctx.beginPath();
      ctx.moveTo(cx - glyphWidth / 2 - 20 / scale, y);
      ctx.lineTo(cx + glyphWidth / 2 + 20 / scale, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'green';
    for (const command of metrics.commands) {
      if (command.x !== undefined && command.y !== undefined) {
        ctx.beginPath();
        ctx.arc(command.x, command.y, 3 / scale, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawGuides(ctx, cx, cy, height, minRatio, maxRatio, scale) {
    const minW = height * minRatio;
    const maxW = height * maxRatio;

    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([5 / scale, 5 / scale]);

    for (const x of [cx - minW / 2, cx + minW / 2, cx - maxW / 2, cx + maxW / 2]) {
      ctx.beginPath();
      ctx.moveTo(x, cy - height / 2 - 10 / scale);
      ctx.lineTo(x, cy + height / 2 + 10 / scale);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  function drawGrid(ctx, width, height) {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 20) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 20) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  function points(metrics) {
    return metrics.commands
      .filter((command) => command.x !== undefined && command.y !== undefined)
      .map((command) => `(${Math.round(command.x)}, ${Math.round(command.y)})`)
      .join(', ');
  }

  function printReport() {
    if (!selected) return;

    const canvasImages = [
      ['I', canvasI.toDataURL('image/png'), selected.i],
      ['H', canvasH.toDataURL('image/png'), selected.h],
      ['O', canvasO.toDataURL('image/png'), selected.o]
    ];
    const report = window.open('', '_blank');
    report.document.write(`
      <html>
      <head>
        <title>ADAFontCheck Report - ${selected.name}</title>
        <style>
          body { font-family: sans-serif; font-size: 12px; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { margin-bottom: 5px; font-size: 18px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; align-items: flex-end; }
          .timestamp { font-size: 0.9em; color: #666; }
          .watermark { font-weight: bold; font-size: 14px; }
          .watermark a { color: #0369a1; text-decoration: none; }
          .disclaimer { font-size: 0.75em; color: #777; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; line-height: 1.3; }
          .compliance { font-size: 0.75em; color: #555; margin-top: 10px; line-height: 1.3; }
          .compliance a { color: #0369a1; }
          .section { margin-bottom: 15px; display: flex; align-items: flex-start; gap: 20px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; break-inside: avoid; }
          .canvas-img { border: 1px solid #ddd; width: 140px; height: 140px; object-fit: contain; background: #fff; }
          .glyph-label { font-weight: bold; font-size: 16px; margin-top: 5px; text-align: center; }
          .metrics { flex: 1; }
          .coords-label { font-weight: bold; margin-top: 5px; display: block; font-size: 0.9em; }
          .coords { font-family: monospace; font-size: 0.85em; color: #444; word-break: break-all; line-height: 1.4; }
          .status-pass { color: green; font-weight: bold; }
          .status-fail { color: red; font-weight: bold; }
          .results-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .results-table th, .results-table td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11px; }
          .results-table th { background: #f2f2f2; }
          .req-info { font-weight: normal; font-size: 0.85em; color: #666; display: block; margin-top: 2px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${selected.name}</h1>
            <div class="timestamp">${new Date().toLocaleString()}</div>
          </div>
          <div class="watermark"><a href="https://adafontcheck.xyz">adafontcheck.xyz</a></div>
        </div>
        <h3 style="margin-top:0;">Compliance Summary</h3>
        <table class="results-table">
          <tr><th>Test</th><th>Federal Requirements</th><th>California Requirements</th></tr>
          <tr>
            <td><strong>Tactile</strong><br><small>Measured - Stroke: ${ratio(selected.stroke.ratio)}, Body: ${ratio(selected.body.ratio)}</small></td>
            <td class="${selected.test.federal.tactile ? 'status-pass' : 'status-fail'}">${passFail(selected.test.federal.tactile)}<span class="req-info">Body: 55-110%, Stroke: 0-15%</span></td>
            <td class="${selected.test.california.tactile ? 'status-pass' : 'status-fail'}">${passFail(selected.test.california.tactile)}<span class="req-info">Body: 60-110%, Stroke: 0-15%</span></td>
          </tr>
          <tr>
            <td><strong>Visual</strong><br><small>Measured - Stroke: ${ratio(selected.stroke.ratio)}, Body: ${ratio(selected.body.ratio)}</small></td>
            <td class="${selected.test.federal.visual ? 'status-pass' : 'status-fail'}">${passFail(selected.test.federal.visual)}<span class="req-info">Body: 55-110%, Stroke: 10-30%</span></td>
            <td class="${selected.test.california.visual ? 'status-pass' : 'status-fail'}">${passFail(selected.test.california.visual)}<span class="req-info">Body: 60-110%, Stroke: 10-20%</span></td>
          </tr>
        </table>
        ${canvasImages.map(([letter, image, metric]) => `
          <div class="section">
            <div>
              <img src="${image}" class="canvas-img">
              <div class="glyph-label">${letter}</div>
            </div>
            <div class="metrics">
              <strong>${letter === 'I' ? 'Stroke' : 'Body'} Width Ratio:</strong> ${ratio(metric.ratio)}<br>
              Width: ${metric.width ? metric.width.toFixed(2) : 'N/A'}, Height: ${metric.height ? metric.height.toFixed(2) : 'N/A'}
              <span class="coords-label">Coordinates (Green Dots):</span>
              <div class="coords">${points(metric)}</div>
            </div>
          </div>`).join('')}
        <div class="disclaimer"><strong>Disclaimer:</strong> ADAFontCheck is not endorsed by the United States Access Board or anyone else. The creators of ADAFontCheck assume no liability or responsibility whatsoever for any direct, indirect, special, or other consequential damages relating to any use of this online service or the contents of this website. Use at your own discretion with confidence.</div>
        <div class="compliance">This service is based on the 2010 Americans with Disabilities Act Accessibility Guidelines, the U.S. Access Board PROWAG section R410 Visual Characters on Signs, and the 2019 California Building Standards Code.</div>
        <div style="margin-top: 0; text-align: center; font-size: 0.8em; color: #555; padding: 10px; border-top: 1px solid #ddd;">Copyright © 2026 - All rights reserved by Crooks Design.</div>
        <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); }<\\/script>
      </body>
      </html>
    `);
    report.document.close();
  }

  onDestroy(() => {
    for (const w of activeWorkers) {
      w.terminate();
    }
    activeWorkers = [];
  });
</script>

<svelte:head>
  <title>ADA Font Check</title>
  <meta
    name="description"
    content="Analyze font glyph metrics against ADA, federal, and California sign character requirements."
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,100..900;1,100..900&display=swap"
    rel="stylesheet"
  />
</svelte:head>


<div class="navbar bg-sky-800">
  <div class="flex-1">
    <div>
      <img src="/media/logo.png" class="btn btn-ghost" style="padding: 10px 10px 0px 10px;" alt="ADAFontCheck" />
    </div>
  </div>
  <div class="flex-none">
    <ul class="menu menu-horizontal px-1">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <li tabindex="0">
        <a class="text-secondary-content" href="/#" on:click|preventDefault>
          Upload
          <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>
        </a>
        <ul class="p-2 bg-base-100 drop-shadow-xl z-3">
          <li class="upload-btn-wrapper">
            <a href="/#" on:click|preventDefault>File</a>
            <input id="single-font" type="file" name="file" multiple accept=".otf,.ttf,.woff,.woff2" on:change={handleFiles} />
          </li>
          <li class="upload-btn-wrapper">
            <a href="/#" on:click|preventDefault>Folder</a>
            <input id="font-name" type="file" webkitdirectory multiple name="folder" on:change={handleFiles} />
          </li>
        </ul>
      </li>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <li tabindex="0">
        <a class="text-secondary-content" href="/#" on:click|preventDefault>
          Settings
          <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>
        </a>
        <ul class="p-2 bg-base-100 z-3 drop-shadow-xl">
          <li>
            <label>
              <input type="checkbox" class="checkbox" id="compact" bind:checked={compact} />
              Compact Table
            </label>
          </li>
          <li>
            <label>
              <input type="checkbox" class="checkbox" id="darkmode" bind:checked={darkMode} />
              Dark Mode
            </label>
          </li>
        </ul>
      </li>
      <li><a class="text-secondary-content" id="clear" href="/#" on:click|preventDefault={clearFonts}>Clear</a></li>
      <li><a class="text-secondary-content" href="/#" on:click|preventDefault={() => downloadResultsCsv(results)}>Export</a></li>
    </ul>
  </div>
</div>

<main class="flex-grow bg-base-100">
  <div class="overflow-x-auto p-8 drop-shadow-lg">


    {#if errors.length}
      <div class="mb-4 text-error text-sm">
        {#each errors as error}
          <div><strong>{error.fileName}</strong>: {error.error}</div>
        {/each}
      </div>
    {/if}

    <table class={`table w-full ${compact ? 'table-compact' : ''}`}>
      <thead>
        <tr>
          <th colspan="3"></th>
          <th colspan="2">Federal Character Tests</th>
          <th colspan="2">California Character Tests</th>
        </tr>
        <tr>
          <th>Font Name</th>
          <th>Body Width</th>
          <th>Stroke Width</th>
          {#each columns as column}
            <th>
              <div>{column.label}</div>
              <div class="font-normal">Body: {column.body}</div>
              <div class="font-normal">Stroke: {column.stroke}</div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody id="data">
        {#if results.length}
          {#each results as result}
            {#if result.error}
              <tr>
                <td colspan="7" class="text-error">{result.fileName}: {result.error}</td>
              </tr>
            {:else}
              <tr>
                <td>
                  <button
                    class="font-inspector-trigger"
                    type="button"
                    on:click={() => showVisualization(result)}
                    title="Open glyph inspector"
                    aria-label={`Open glyph inspector for ${result.name}`}
                    data-tooltip="Open glyph inspector"
                  >
                    <span class="font-inspector-label">{result.name}</span>
                    {@html inspectIcon}
                  </button>
                </td>
                <td>{ratio(result.body.ratio)}</td>
                <td>{ratio(result.stroke.ratio)}</td>
                {#each columns as column}
                  {@const passed = column.get(result)}
                  <td name={column.region} class={colorResults(passed)} data-export-value={passFail(passed)}>
                    {@html iconResults(passed)}
                  </td>
                {/each}
              </tr>
            {/if}
          {/each}
        {:else}
          <tr>
            <td>Typeface 1</td>
            <td>65.00%</td>
            <td>35.00%</td>
            <td name="federal" class="text-error" data-export-value="Fail">{@html failIcon}</td>
            <td name="federal" class="text-error" data-export-value="Fail">{@html failIcon}</td>
            <td name="california" class="text-error" data-export-value="Fail">{@html failIcon}</td>
            <td name="california" class="text-error" data-export-value="Fail">{@html failIcon}</td>
          </tr>
          <tr>
            <td>Typeface 2</td>
            <td>70.00%</td>
            <td>15.00%</td>
            <td name="federal" class="text-success" data-export-value="Pass">{@html passIcon}</td>
            <td name="federal" class="text-success" data-export-value="Pass">{@html passIcon}</td>
            <td name="california" class="text-success" data-export-value="Pass">{@html passIcon}</td>
            <td name="california" class="text-success" data-export-value="Pass">{@html passIcon}</td>
          </tr>
          <tr>
            <td>Typeface 3</td>
            <td>70.00%</td>
            <td>25.00%</td>
            <td name="federal" class="text-success" data-export-value="Pass">{@html passIcon}</td>
            <td name="federal" class="text-success" data-export-value="Pass">{@html passIcon}</td>
            <td name="california" class="text-success" data-export-value="Pass">{@html passIcon}</td>
            <td name="california" class="text-error" data-export-value="Fail">{@html failIcon}</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</main>

<footer class="footer footer-center p-10 bg-base-300 text-base-content mt-auto">
  <div class="grid grid-flow-col gap-4">
    <label for="about-modal" class="link link-hover">About</label>
    <label for="tests-modal" class="link link-hover">Tests</label>
    <label for="usage-modal" class="link link-hover">Usage</label>
    <label for="compliance-modal" class="link link-hover">Compliance</label>
    <label for="disclaimer-modal" class="link link-hover">Disclaimer</label>
  </div>
  <div>
    <div class="grid grid-flow-col gap-4">
      <a href="https://opentype.js.org/glyph-inspector.html" aria-label="Glyph inspector">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
          <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
        </svg>
      </a>
      <a href="https://github.com/inVariabl/ADAFontCheck" aria-label="Source">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
          <path fill-rule="evenodd" d="M14.447 3.027a.75.75 0 01.527.92l-4.5 16.5a.75.75 0 01-1.448-.394l4.5-16.5a.75.75 0 01.921-.526zM16.72 6.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 11-1.06-1.06L21.44 12l-4.72-4.72a.75.75 0 010-1.06zm-9.44 0a.75.75 0 010 1.06L2.56 12l4.72 4.72a.75.75 0 11-1.06 1.06L.97 12.53a.75.75 0 010-1.06l5.25-5.25a.75.75 0 011.06 0z" clip-rule="evenodd" />
        </svg>
      </a>
      <a href="https://paypal.me/DanielCrooks?country.x=US&locale.x=en_US" aria-label="Donate">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </a>
    </div>
  </div>
  <div>
    <p>Copyright © 2026 - All rights reserved by Crooks Design.</p>
  </div>
</footer>

<input type="checkbox" id="about-modal" class="modal-toggle" />
<label for="about-modal" class="modal cursor-pointer">
  <label class="modal-box relative" for="">
    <h3 class="text-lg font-bold">About ADA Font Check</h3>
    <p class="py-4">ADAFontCheck determines if a font meets U.S. Federal and California ADA accessibility regulations for tactile and visual signage using <a class="link" href="https://opentype.js.org/">opentype.js</a> with a C/WASM fast path.</p>
  </label>
</label>

<input type="checkbox" id="tests-modal" class="modal-toggle" />
<label for="tests-modal" class="modal cursor-pointer">
  <label class="modal-box relative" for="">
    <h3 class="text-lg font-bold">ADA Tests Overview</h3>
    <p>ADAFontCheck perfoms the following tests:</p>
    <ul class="p-4 list-disc">
      <li>Character Stroke Width ratio using the uppercase letter 'I'.</li>
      <li>Character Body Width ratio using the uppercase letters 'I,' 'H,' and 'O'.</li>
      <li>Italic Font detection.</li>
      <li>Serif Font detection.</li>
      <li>Sans Serif Font determination.</li>
      <li>Fonts must meet the ratio requirements of both Tests 1 and 2 for ADA compliance.</li>
      <li>Numerals are not tested for compliance but are considered compatible when used with letters of the same font set and size.</li>
    </ul>
  </label>
</label>

<input type="checkbox" id="usage-modal" class="modal-toggle" />
<label for="usage-modal" class="modal cursor-pointer">
  <label class="modal-box relative" for="">
    <h3 class="text-lg font-bold">How to use ADAFontCheck</h3>
    <ol class="list-decimal p-4">
      <li>Select "Folder Upload" for multiple fonts or "File Upload" for a single font.</li>
      <li>Navigate to your fonts source files.</li>
      <li>Select the fonts and upload.</li>
      <li>Review the test results. <i>Note that results appear for Sans Serif fonts only. Fonts that are not Sans Serif do not comply with ADA requirements.</i></li>
      <li>Export the tests results.</li>
    </ol>
  </label>
</label>

<input type="checkbox" id="compliance-modal" class="modal-toggle" />
<label for="compliance-modal" class="modal cursor-pointer">
  <label class="modal-box relative" for="">
    <h3 class="text-lg font-bold">ADAFontCheck Compliance Information</h3>
    <ol class="py-4 list-none">
      This service is based on the <a class="link" href="https://archive.ada.gov/regs2010/2010ADAStandards/2010ADAStandards.pdf">2010 Americans with Disabilities Act Accessibility Guidelines (703.2.4, 703.2.6, 703.5.4, 703.5.7)</a>, the <a class="link" href="https://www.access-board.gov/prowag/supplemental.html#r410-visual-characters-on-signs">U.S. Access Board PROWAG section R410 Visual Characters on Signs (410.1, 410.3, 410.4, 410.5, 410.7)</a>, and the <a class="link" href="https://up.codes/viewer/california/ibc-2018/chapter/new_11B/accessibility-to-public-buildings-public-accommodations-commercial-buildings-and#new_11B-703">2019 California Building Standards Code (11B-703.2.4 / 1143A.6.4, 11B-703.2.6 / 1143.A.6.5, 11B-703.5.4 / 1143.A.5.3, 11B-703.5.7 / 1143A.5.6)</a>.
    </ol>
  </label>
</label>

<input type="checkbox" id="disclaimer-modal" class="modal-toggle" />
<label for="disclaimer-modal" class="modal cursor-pointer">
  <label class="modal-box relative" for="">
    <h3 class="text-lg font-bold">Disclaimer</h3>
    <ol class="list-decimal p-5">
      <li>ADAFontCheck is not endorsed by the United States Access Board or anyone else.</li>
      <li>The creators of ADAFontCheck assume no liability or responsibility whatsoever for any direct, indirect, special, or other consequential damages relating to any use of this online service or the contents of this website.</li>
      <li>Use at your own discretion with confidence.</li>
    </ol>
  </label>
</label>

<div class="modal" class:modal-open={processing}>
  <div class="modal-box">
    <h3 class="text-lg font-bold">Processing Fonts</h3>
    <p class="py-4">{processed} of {total} fonts processed</p>
    <div class="w-full bg-base-300" style="height: 1rem; border-radius: 9999px;">
      <div
        class="bg-success"
        style="width: {total > 0 ? (processed / total) * 100 : 0}%; height: 1rem; border-radius: 9999px; transition: width 0.3s;"
      ></div>
    </div>
  </div>
</div>

<input
  type="checkbox"
  id="visualize-modal"
  class="modal-toggle"
  bind:checked={visualizeOpen}
  on:change={() => {
    if (!visualizeOpen) closeVisualization();
  }}
/>
<label for="visualize-modal" class="modal cursor-pointer">
  <label class="modal-box relative" style="max-width: none; width: auto;" for="">
    {#if selected}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 class="text-lg font-bold" id="visualize-title">Glyph Inspector: {selected.name}</h3>
        <button class="btn btn-sm btn-primary" type="button" on:click={printReport}>Print PDF Report</button>
      </div>
      <div class="flex flex-row flex-wrap lg:flex-nowrap justify-center p-4" style="gap: 2em;">
        <div class="text-center">
          <h4 class="font-bold text-xl mb-2">I</h4>
          <canvas bind:this={canvasI} width="400" height="400" class="border border-base-300 bg-base-100"></canvas>
          <div class="text-sm mt-2 text-left p-2 bg-base-200 rounded">
            <div class="grid grid-cols-2 gap-1" style="grid-template-columns: auto 1fr; gap: 0 1em;">
              <span>Width:</span> <span class="font-mono text-right">{selected.i.width ? selected.i.width.toFixed(2) : 'N/A'}</span>
              <span>Height:</span> <span class="font-mono text-right">{selected.i.height ? selected.i.height.toFixed(2) : 'N/A'}</span>
              <span>Ratio:</span> <span class="font-mono text-right font-bold">{selected.i.ratio ? ratio(selected.i.ratio) : 'N/A'}</span>
            </div>
          </div>
        </div>
        <div class="text-center">
          <h4 class="font-bold text-xl mb-2">H</h4>
          <canvas bind:this={canvasH} width="400" height="400" class="border border-base-300 bg-base-100"></canvas>
          <div class="text-sm mt-2 text-left p-2 bg-base-200 rounded">
            <div class="grid grid-cols-2 gap-1" style="grid-template-columns: auto 1fr; gap: 0 1em;">
              <span>Width:</span> <span class="font-mono text-right">{selected.h.width ? selected.h.width.toFixed(2) : 'N/A'}</span>
              <span>Height:</span> <span class="font-mono text-right">{selected.h.height ? selected.h.height.toFixed(2) : 'N/A'}</span>
              <span>Ratio:</span> <span class="font-mono text-right font-bold">{selected.h.ratio ? ratio(selected.h.ratio) : 'N/A'}</span>
            </div>
          </div>
        </div>
        <div class="text-center">
          <h4 class="font-bold text-xl mb-2">O</h4>
          <canvas bind:this={canvasO} width="400" height="400" class="border border-base-300 bg-base-100"></canvas>
          <div class="text-sm mt-2 text-left p-2 bg-base-200 rounded">
            <div class="grid grid-cols-2 gap-1" style="grid-template-columns: auto 1fr; gap: 0 1em;">
              <span>Width:</span> <span class="font-mono text-right">{selected.o.width ? selected.o.width.toFixed(2) : 'N/A'}</span>
              <span>Height:</span> <span class="font-mono text-right">{selected.o.height ? selected.o.height.toFixed(2) : 'N/A'}</span>
              <span>Ratio:</span> <span class="font-mono text-right font-bold">{selected.o.ratio ? ratio(selected.o.ratio) : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </label>
</label>
