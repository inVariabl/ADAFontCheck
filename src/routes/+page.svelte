<script>
  import { onDestroy } from 'svelte';
  import { downloadResultsCsv } from '$lib/csv.js';
  import MetricList from '$lib/MetricList.svelte';
  import './styles.css';

  const columns = [
    {
      key: 'federalTactile',
      label: 'Federal Tactile',
      region: 'federal',
      body: '55% - 110%',
      stroke: '0% - 15%',
      get: (result) => result.test.federal.tactile
    },
    {
      key: 'federalVisual',
      label: 'Federal Visual',
      region: 'federal',
      body: '55% - 110%',
      stroke: '10% - 30%',
      get: (result) => result.test.federal.visual
    },
    {
      key: 'californiaTactile',
      label: 'California Tactile',
      region: 'california',
      body: '60% - 110%',
      stroke: '0% - 15%',
      get: (result) => result.test.california.tactile
    },
    {
      key: 'californiaVisual',
      label: 'California Visual',
      region: 'california',
      body: '60% - 110%',
      stroke: '10% - 20%',
      get: (result) => result.test.california.visual
    }
  ];

  let worker;
  let requestId = 0;
  let results = [];
  let errors = [];
  let processed = 0;
  let total = 0;
  let processing = false;
  let compact = false;
  let darkMode = false;
  let federalOnly = false;
  let californiaOnly = false;
  let selected = null;
  let canvasI;
  let canvasH;
  let canvasO;

  $: visibleResults = results.filter((result) => {
    if (result.error) {
      return true;
    }
    const failsFederal = !result.test.federal.tactile || !result.test.federal.visual;
    const failsCalifornia = !result.test.california.tactile || !result.test.california.visual;
    if (federalOnly && !failsFederal) {
      return false;
    }
    if (californiaOnly && !failsCalifornia) {
      return false;
    }
    return true;
  });

  $: if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = darkMode ? 'black' : 'emerald';
  }

  $: if (selected) {
    queueMicrotask(() => drawSelectedGlyphs());
  }

  function getWorker() {
    worker ??= new Worker(new URL('$lib/fontWorker.js', import.meta.url), { type: 'module' });
    return worker;
  }

  async function handleFiles(event) {
    const files = Array.from(event.currentTarget.files ?? []).filter((file) =>
      /\.(otf|ttf|woff|woff2)$/i.test(file.name)
    );
    event.currentTarget.value = '';

    if (!files.length) {
      return;
    }

    await processFiles(files);
  }

  async function processFiles(files) {
    processing = true;
    processed = 0;
    total = files.length;
    results = [];
    errors = [];
    selected = null;

    const id = (requestId += 1);
    const payload = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        buffer: await file.arrayBuffer()
      }))
    );

    getWorker().onmessage = (event) => {
      if (event.data.id !== id) {
        return;
      }

      if (event.data.type === 'progress') {
        processed = event.data.processed;
        total = event.data.total;
      }

      if (event.data.type === 'complete') {
        results = event.data.results;
        errors = results.filter((result) => result.error);
        processing = false;
      }

      if (event.data.type === 'error') {
        errors = [{ fileName: 'Worker', error: event.data.error }];
        processing = false;
      }
    };

    getWorker().postMessage({ id, files: payload }, payload.map((file) => file.buffer));
  }

  function clearFonts() {
    results = [];
    errors = [];
    processed = 0;
    total = 0;
    selected = null;
  }

  function showInspector(result) {
    if (result.error) {
      return;
    }
    selected = result;
  }

  function closeInspector() {
    selected = null;
  }

  function drawSelectedGlyphs() {
    if (!selected) {
      return;
    }
    drawGlyph(canvasI, 'I', selected.i);
    drawGlyph(canvasH, 'H', selected.h);
    drawGlyph(canvasO, 'O', selected.o);
  }

  function drawGlyph(canvas, char, metrics) {
    if (!canvas || !metrics) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
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

    const glyphWidth = maxX - minX;
    const glyphHeight = maxY - minY;
    const cx = minX + glyphWidth / 2;
    const cy = minY + glyphHeight / 2;
    const padding = 70;
    const scale = Math.min((width - padding) / glyphWidth, (height - padding) / glyphHeight, 20);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    ctx.beginPath();
    for (const command of metrics.commands) {
      if (command.type === 'M') ctx.moveTo(command.x, command.y);
      if (command.type === 'L') ctx.lineTo(command.x, command.y);
      if (command.type === 'C') ctx.bezierCurveTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y);
      if (command.type === 'Q') ctx.quadraticCurveTo(command.x1, command.y1, command.x, command.y);
      if (command.type === 'Z') ctx.closePath();
    }
    ctx.fillStyle = 'rgba(55, 65, 81, 0.16)';
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

    ctx.strokeStyle = 'rgba(37, 99, 235, 0.9)';
    ctx.lineWidth = 2 / scale;
    for (const x of metrics.x ?? []) {
      ctx.beginPath();
      ctx.moveTo(x, cy - glyphHeight / 2 - 20 / scale);
      ctx.lineTo(x, cy + glyphHeight / 2 + 20 / scale);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)';
    for (const y of metrics.y ?? []) {
      ctx.beginPath();
      ctx.moveTo(cx - glyphWidth / 2 - 20 / scale, y);
      ctx.lineTo(cx + glyphWidth / 2 + 20 / scale, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#15803d';
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
    ctx.strokeStyle = '#d97706';
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

  function metricRows(result) {
    return [
      ['I', result.i],
      ['H', result.h],
      ['O', result.o]
    ];
  }

  function points(metrics) {
    return metrics.commands
      .filter((command) => command.x !== undefined && command.y !== undefined)
      .map((command) => `(${Math.round(command.x)}, ${Math.round(command.y)})`)
      .join(', ');
  }

  function printReport() {
    if (!selected) {
      return;
    }

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
            body { font-family: Arial, sans-serif; font-size: 12px; color: #111827; padding: 20px; max-width: 820px; margin: 0 auto; }
            h1 { margin: 0 0 4px; font-size: 20px; }
            h2 { font-size: 15px; margin: 18px 0 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: left; vertical-align: top; }
            th { background: #f1f5f9; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1f2937; padding-bottom: 10px; }
            .pass { color: #047857; font-weight: bold; }
            .fail { color: #b91c1c; font-weight: bold; }
            .section { display: flex; gap: 18px; padding: 14px 0; border-bottom: 1px solid #e5e7eb; break-inside: avoid; }
            .canvas-img { width: 150px; height: 150px; border: 1px solid #cbd5e1; object-fit: contain; }
            .coords { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #475569; line-height: 1.4; word-break: break-word; }
            .small { color: #64748b; font-size: 11px; }
            .legal { color: #64748b; font-size: 10px; line-height: 1.35; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${selected.name}</h1>
              <div class="small">${new Date().toLocaleString()}</div>
            </div>
            <div>adafontcheck.xyz</div>
          </div>
          <h2>Compliance Summary</h2>
          <table>
            <tr><th>Test</th><th>Federal</th><th>California</th></tr>
            <tr>
              <td>Tactile<br><span class="small">Stroke ${selected.stroke.ratio}%, Body ${selected.body.ratio}%</span></td>
              <td class="${selected.test.federal.tactile ? 'pass' : 'fail'}">${selected.test.federal.tactile ? 'PASS' : 'FAIL'}<br><span class="small">Body 55-110%, Stroke 0-15%</span></td>
              <td class="${selected.test.california.tactile ? 'pass' : 'fail'}">${selected.test.california.tactile ? 'PASS' : 'FAIL'}<br><span class="small">Body 60-110%, Stroke 0-15%</span></td>
            </tr>
            <tr>
              <td>Visual<br><span class="small">Stroke ${selected.stroke.ratio}%, Body ${selected.body.ratio}%</span></td>
              <td class="${selected.test.federal.visual ? 'pass' : 'fail'}">${selected.test.federal.visual ? 'PASS' : 'FAIL'}<br><span class="small">Body 55-110%, Stroke 10-30%</span></td>
              <td class="${selected.test.california.visual ? 'pass' : 'fail'}">${selected.test.california.visual ? 'PASS' : 'FAIL'}<br><span class="small">Body 60-110%, Stroke 10-20%</span></td>
            </tr>
          </table>
          ${canvasImages
            .map(
              ([letter, image, metric]) => `
              <div class="section">
                <img src="${image}" class="canvas-img" alt="${letter}">
                <div>
                  <h2>${letter}</h2>
                  <div>Width: ${metric.width.toFixed(2)} | Height: ${metric.height.toFixed(2)} | Ratio: ${metric.ratio}%</div>
                  <div class="coords">${points(metric)}</div>
                </div>
              </div>`
            )
            .join('')}
          <div class="legal">
            ADAFontCheck is not endorsed by the United States Access Board. This report is based on the app's glyph metric analysis and should be reviewed before use in production signage decisions.
          </div>
          <script>window.onload = () => setTimeout(() => window.print(), 300);<\\/script>
        </body>
      </html>
    `);
    report.document.close();
  }

  onDestroy(() => {
    worker?.terminate();
  });
</script>

<svelte:head>
  <title>ADA Font Check</title>
  <meta
    name="description"
    content="Analyze font glyph metrics against ADA, federal, and California sign character requirements."
  />
</svelte:head>

<div class:dark={darkMode} class="app-shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="ADAFontCheck home">
      <img src="/media/logo.png" alt="ADAFontCheck" />
    </a>

    <nav class="toolbar" aria-label="Font tools">
      <label class="file-button">
        <span>File</span>
        <input type="file" accept=".otf,.ttf,.woff,.woff2" multiple on:change={handleFiles} />
      </label>
      <label class="file-button">
        <span>Folder</span>
        <input type="file" webkitdirectory multiple on:change={handleFiles} />
      </label>
      <button type="button" on:click={clearFonts} disabled={!results.length && !errors.length}>Clear</button>
      <button type="button" on:click={() => downloadResultsCsv(results)} disabled={!results.length}>Export</button>
    </nav>
  </header>

  <main>
    <section class="controls-band">
      <div>
        <h1>ADA Font Check</h1>
        <p>{processing ? `Processing ${processed} of ${total}` : `${results.length} font${results.length === 1 ? '' : 's'} loaded`}</p>
      </div>

      <div class="settings" aria-label="Display settings">
        <label><input type="checkbox" bind:checked={compact} /> Compact</label>
        <label><input type="checkbox" bind:checked={darkMode} /> Dark</label>
        <label><input type="checkbox" bind:checked={federalOnly} /> Federal fails</label>
        <label><input type="checkbox" bind:checked={californiaOnly} /> California fails</label>
      </div>
    </section>

    {#if errors.length}
      <section class="notice" aria-live="polite">
        {#each errors as error}
          <div><strong>{error.fileName}</strong>: {error.error}</div>
        {/each}
      </section>
    {/if}

    <section class="table-wrap" aria-live="polite">
      <table class:compact>
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
                <span>{column.label}</span>
                <small>Body: {column.body}</small>
                <small>Stroke: {column.stroke}</small>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#if visibleResults.length}
            {#each visibleResults as result}
              {#if result.error}
                <tr class="error-row">
                  <td colspan="7">{result.fileName}: {result.error}</td>
                </tr>
              {:else}
                <tr>
                  <td>
                    <button class="font-link" type="button" on:click={() => showInspector(result)}>
                      <span>{result.name}</span>
                      <span class="inspect-badge" aria-hidden="true">Inspect</span>
                    </button>
                  </td>
                  <td>{result.body.ratio}%</td>
                  <td>{result.stroke.ratio}%</td>
                  {#each columns as column}
                    {@const passed = column.get(result)}
                    <td class:pass={passed} class:fail={!passed} data-region={column.region}>
                      <span class="result-badge" aria-label={passed ? 'Pass' : 'Fail'}>{passed ? 'PASS' : 'FAIL'}</span>
                    </td>
                  {/each}
                </tr>
              {/if}
            {/each}
          {:else}
            <tr class="empty-row">
              <td colspan="7">Upload one or more `.otf`, `.ttf`, `.woff`, or `.woff2` files.</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </section>
  </main>

  <footer>
    <button type="button" on:click={() => alert('ADAFontCheck determines if a font meets U.S. Federal and California ADA accessibility regulations for tactile and visual signage using opentype.js, Web Workers, and C WASM.')}>About</button>
    <a href="https://opentype.js.org/glyph-inspector.html">Glyph Inspector</a>
    <a href="https://github.com/inVariabl/ADAFontCheck">Source</a>
    <span>Copyright © 2026 - All rights reserved by Crooks Design.</span>
  </footer>

  {#if selected}
    <div class="modal-backdrop" role="presentation" on:click={closeInspector}></div>
    <div class="inspector" role="dialog" aria-modal="true" aria-labelledby="inspector-title">
      <header>
        <div>
          <h2 id="inspector-title">Glyph Inspector: {selected.name}</h2>
          <p>Sans serif: {selected.test.sansSerif ? 'Yes' : 'No'} | Not italic: {selected.test.notitalic ? 'Yes' : 'No'}</p>
        </div>
        <div class="inspector-actions">
          <button type="button" on:click={printReport}>Print</button>
          <button type="button" on:click={closeInspector}>Close</button>
        </div>
      </header>

      <div class="glyph-grid">
        <article>
          <canvas bind:this={canvasI} width="280" height="280"></canvas>
          <h3>I</h3>
          <MetricList metric={selected.i} />
        </article>
        <article>
          <canvas bind:this={canvasH} width="280" height="280"></canvas>
          <h3>H</h3>
          <MetricList metric={selected.h} />
        </article>
        <article>
          <canvas bind:this={canvasO} width="280" height="280"></canvas>
          <h3>O</h3>
          <MetricList metric={selected.o} />
        </article>
      </div>

      <table class="metrics-table">
        <thead>
          <tr><th>Glyph</th><th>Width</th><th>Height</th><th>Ratio</th></tr>
        </thead>
        <tbody>
          {#each metricRows(selected) as [letter, metric]}
            <tr>
              <td>{letter}</td>
              <td>{metric.width.toFixed(2)}</td>
              <td>{metric.height.toFixed(2)}</td>
              <td>{metric.ratio}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
