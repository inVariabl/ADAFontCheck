window.processedFonts = [];

const folder = document.querySelector('input[name="folder"]');
const file = document.querySelector('input[name="file"]');
if (folder) {
  folder.addEventListener('change', onReadFolder, false);
}
if (file) {
  file.addEventListener('change', onReadFolder, false);
}

function onReadFolder(e) {
  clearFonts();
  const fontFiles = e.target.files;
  for (let i = 0; i < fontFiles.length; i++) {
    const file = fontFiles[i];
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const font = opentype.parse(e.target.result);
        const result = checkfont(font); 
        window.processedFonts.push(result);
        const fontIndex = window.processedFonts.length - 1;

        console.log(result);
        try {

          function iconResults(test) {
            let passSVG =
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6" style="color: green;"><path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" /></svg>`;
            let failSVG =
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>`;
            if (test) {
              return passSVG;
            } else {
              return failSVG;
            }
          }

          function colorResults(test) {
            if (test) {
              return 'text-success';
            } else {
              return 'text-error';
            }
          }

          let html = ``;
          html = `
            <tr>
              <td>
                <button class="btn btn-ghost btn-sm normal-case font-normal p-0 hover:bg-transparent hover:underline hover:text-primary text-left h-auto min-h-0" style="text-transform: none;" onclick="showVisualization(${fontIndex})">
                  ${result.name}
                </button>
              </td>
              <td>${result.body.ratio}%</td>
              <td>${result.stroke.ratio}%</td>

              <td name="federal" class="${
              colorResults(result.test.federal.tactile)}" data-export-value="${
              passFail(result.test.federal.tactile)}">${
              iconResults(result.test.federal.tactile)}</td>
              <td name="federal" class="${
              colorResults(result.test.federal.visual)}" data-export-value="${
              passFail(result.test.federal.visual)}">${
              iconResults(result.test.federal.visual)}</td>
              <td name="california" class="${
              colorResults(
                  result.test.california.tactile)}" data-export-value="${
              passFail(result.test.california.tactile)}">${
              iconResults(result.test.california.tactile)}</td>
              <td name="california" class="${
              colorResults(
                  result.test.california.visual)}" data-export-value="${
              passFail(result.test.california.visual)}">${
              iconResults(result.test.california.visual)}</td>
            </tr>
          `;
          document.getElementById('data').innerHTML += html;
        } catch (err) {
          console.error("HTML Insertion Error");
        }
      } catch (err) {
        console.error('onRead error');
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function test(result) {
  try {
    if (result) { // Pass
      return 'text-success';
    } else {
      if (document.getElementById("ada_only").checked) {
        return 'text-error';
      }
    }
  } catch (err) {
    console.error("ADA Results Error");
  }
}

function passFail(testName) { return testName ? [ "Pass" ] : [ "Fail" ]; }

function clearFonts() { 
  document.getElementById("data").innerHTML = ""; 
  window.processedFonts = [];
}

function downloadCSV() {
  const rows = document.querySelectorAll("table tr");
  let csvContent = "data:text/csv;charset=utf-8,";

  // Get today's date
  const today = new Date();
  const date = today.getFullYear().toString().padStart(2, '0') +
               (today.getMonth() + 1).toString().padStart(2, '0') +
               today.getDate().toString().padStart(2, '0');

  // Generate UUID
  const uuid = generateUUID();

  // Combine date and UUID for filename
  const fileName = `adafontcheck-${date}-${uuid}.csv`;

  // Header formatting
  const headers = [
    '', '', '', '', 'FEDERAL CHARACTER TESTS', '', 'CALIFORNIA CHARACTER TESTS', ''
  ];
  csvContent += headers.join(",") + "\r\n";

  // Start iterating from the second set of <tr> elements
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowData = [];
    const cols = row.querySelectorAll("th, td");

    cols.forEach(function(col, colIndex) {
      if (colIndex >= 3 && colIndex <= 6) {
        // For merged cells, concatenate text content without newline characters
        const cellText = Array.from(col.querySelectorAll("div"))
                             .map(div => div.innerText.trim())
                             .join(' ');
        // Check for data attribute and include its value in CSV content
        const exportValue = col.getAttribute('data-export-value');
        rowData.push(exportValue ? exportValue : cellText);
      } else {
        rowData.push(col.innerText);
      }
    });

    csvContent += rowData.join(",") + "\r\n";
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
}

function generateUUID() {
  let uuid = "";
  for (let i = 0; i < 4; i++) {
    uuid += Math.floor(Math.random() * 10);
  }
  return uuid;
}

function toggleCompactTable() {
  const tableElement = document.querySelector("body > main > div > table")
  tableElement.classList.toggle('table-compact');
}

function toggleTheme() {
  const htmlElement = document.querySelector('html');
  if (htmlElement.getAttribute('data-theme') === 'emerald') {
    htmlElement.setAttribute('data-theme', 'black');
  } else {
    htmlElement.setAttribute('data-theme', 'emerald');
  }
}

let federalOnly = false;
let californiaOnly = false;

function toggleFederalOnly() {
  federalOnly = !federalOnly;
  updateTableRows();
}

function toggleCaliforniaOnly() {
  californiaOnly = !californiaOnly;
  updateTableRows();
}

function updateTableRows() {
  console.log({federalOnly, californiaOnly});
  const rows = document.querySelectorAll("tbody > tr");
  rows.forEach(row => {
    const failsFederalTest =
        row.querySelector("td[name='federal'].text-error") !== null;
    const failsCaliforniaTest =
        row.querySelector("td[name='california'].text-error") !== null;

    // Determine whether to show or hide the row
    if ((federalOnly && !failsFederalTest) ||
        (californiaOnly && !failsCaliforniaTest)) {
      row.style.display = 'table-row';
    } else if (federalOnly || californiaOnly) {
      row.style.display = 'none';
    } else {
      row.style.display = 'table-row'; // Show all rows if no filters are active
    }
  });
}

// Visualization Logic
window.showVisualization = function(index) {
  const result = window.processedFonts[index];
  if (!result) return;
  
  document.getElementById('visualize-modal').checked = true;
  document.getElementById('visualize-title').innerText = `Glyph Inspector: ${result.name}`;

  drawGlyph('canvas-i', 'I', result.i, result.original);
  drawGlyph('canvas-h', 'H', result.h, result.original);
  drawGlyph('canvas-o', 'O', result.o, result.original);
  
  updateInfo('info-i', result.i);
  updateInfo('info-h', result.h);
  updateInfo('info-o', result.o);
}

function updateInfo(id, metrics) {
    const el = document.getElementById(id);
    if(el) {
        el.innerHTML = `
            <div class="grid grid-cols-2 gap-1" style="grid-template-columns: auto 1fr; gap: 0 1em;">
                <span>Width:</span> <span class="font-mono text-right">${metrics.width ? metrics.width.toFixed(2) : 'N/A'}</span>
                <span>Height:</span> <span class="font-mono text-right">${metrics.height ? metrics.height.toFixed(2) : 'N/A'}</span>
                <span>Ratio:</span> <span class="font-mono text-right font-bold">${metrics.ratio ? metrics.ratio + '%' : 'N/A'}</span>
            </div>
        `;
    }
}

function drawGlyph(canvasId, char, metrics, font) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw Grid
    drawGrid(ctx, width, height);

    if (!font) return;

    // Get raw path again to ensure we match the calculation logic
    // checkfont uses: opentype.getPath(letter, 0, 150, 72)
    const fontSize = 72;
    const xOrigin = 0;
    const yOrigin = 150;
    const path = font.getPath(char, xOrigin, yOrigin, fontSize);
    
    // Determine bounds for centering
    // We try to use the measured metrics first to focus on what was measured
    let minX, maxX, minY, maxY;

    if (metrics.x && metrics.x.length > 0) {
        minX = metrics.x[0];
        maxX = metrics.x[metrics.x.length-1];
    } 
    if (metrics.y && metrics.y.length > 0) {
        minY = metrics.y[0];
        maxY = metrics.y[metrics.y.length-1];
    }
    
    // Fallback to bounding box if metrics are missing (e.g. calculation failed)
    const box = path.getBoundingBox();
    if (minX === undefined) minX = box.x1;
    if (maxX === undefined) maxX = box.x2;
    if (minY === undefined) minY = box.y1;
    if (maxY === undefined) maxY = box.y2;
    
    // Calculate dimensions
    let w = maxX - minX;
    let h = maxY - minY;
    
    // Prevent zero dimensions from breaking scale
    if (w === 0) w = 10;
    if (h === 0) h = 10;
    
    const cx = minX + w/2;
    const cy = minY + h/2;
    
    // Scale and translate
    // We want to fit w/h into canvas with some padding (e.g. 20%)
    const padding = 60;
    const availableW = width - padding;
    const availableH = height - padding;
    
    let scale = Math.min(availableW / w, availableH / h);
    
    // Limit max scale to avoid tiny glyphs becoming massive
    if (scale > 20) scale = 20; 
    
    ctx.save();
    
    // Center logic:
    // Translate to center of canvas
    ctx.translate(width/2, height/2);
    // Scale
    ctx.scale(scale, scale);
    // Translate back by the center of the glyph
    ctx.translate(-cx, -cy);
    
    // Draw Glyph
    // ctx.fillStyle = '#374151'; // gray-700
    // path.fill = '#374151';
    // path.draw(ctx);
    
    // Custom Draw to handle style
    ctx.beginPath();
    path.commands.forEach(cmd => {
        if (cmd.type === 'M') ctx.moveTo(cmd.x, cmd.y);
        else if (cmd.type === 'L') ctx.lineTo(cmd.x, cmd.y);
        else if (cmd.type === 'C') ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        else if (cmd.type === 'Q') ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
        else if (cmd.type === 'Z') ctx.closePath();
    });
    ctx.fillStyle = 'rgba(55, 65, 81, 0.2)'; // Faint fill
    ctx.fill();
    ctx.lineWidth = 1/scale; // Thin line relative to scale
    ctx.strokeStyle = '#374151';
    ctx.stroke();
    
    // Draw Measurement Lines
    const lineWidth = 2/scale;
    
    // Draw Acceptable Range Guides
    // Based on Height, what should the width be?
    // I (Stroke): 10% - 30% (Federal Visual covers widest range, CA is 10-20)
    // H, O (Body): 60% - 110% (California is 60-110, Fed is 55-110. Using 60-110 as safe range)
    if (h > 0) {
        if (char === 'I') {
             drawGuides(ctx, cx, cy, h, 0.10, 0.30, scale, "Visual (10-30%)");
        } else if (char === 'H' || char === 'O') {
             drawGuides(ctx, cx, cy, h, 0.60, 1.10, scale, "Body (60-110%)");
        }
    }

    // X lines (Vertical) - BLUE
    ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
    ctx.lineWidth = lineWidth;
    ctx.setLineDash([]); // Solid lines for measurement
    if (metrics.x) {
        metrics.x.forEach(x => {
            ctx.beginPath();
            // Draw a bit beyond the vertical bounds
            ctx.moveTo(x, cy - h/2 - (20/scale));
            ctx.lineTo(x, cy + h/2 + (20/scale));
            ctx.stroke();
        });
    }
    
    // Y lines (Horizontal) - RED
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    if (metrics.y) {
        metrics.y.forEach(y => {
            ctx.beginPath();
            ctx.moveTo(cx - w/2 - (20/scale), y);
            ctx.lineTo(cx + w/2 + (20/scale), y);
            ctx.stroke();
        });
    }

    // Draw Points
    ctx.fillStyle = 'green';
    path.commands.forEach(cmd => {
        if (cmd.x !== undefined && cmd.y !== undefined) {
             ctx.beginPath();
             ctx.arc(cmd.x, cmd.y, 3/scale, 0, 2 * Math.PI);
             ctx.fill();
        }
    });

    ctx.restore();
}

function drawGuides(ctx, cx, cy, height, minRatio, maxRatio, scale, label) {
    const minW = height * minRatio;
    const maxW = height * maxRatio;
    
    ctx.strokeStyle = 'orange';
    ctx.fillStyle = 'orange';
    ctx.lineWidth = 2/scale;
    ctx.setLineDash([5/scale, 5/scale]); // Dashed
    
    // Min Width Lines (Inner)
    const minLeft = cx - minW/2;
    const minRight = cx + minW/2;
    
    ctx.beginPath();
    ctx.moveTo(minLeft, cy - height/2);
    ctx.lineTo(minLeft, cy + height/2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(minRight, cy - height/2);
    ctx.lineTo(minRight, cy + height/2);
    ctx.stroke();

    // Max Width Lines (Outer)
    const maxLeft = cx - maxW/2;
    const maxRight = cx + maxW/2;

    ctx.beginPath();
    ctx.moveTo(maxLeft, cy - height/2 - (10/scale)); // Slightly taller
    ctx.lineTo(maxLeft, cy + height/2 + (10/scale));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(maxRight, cy - height/2 - (10/scale));
    ctx.lineTo(maxRight, cy + height/2 + (10/scale));
    ctx.stroke();
    
    // Reset Dash
    ctx.setLineDash([]);
}

function drawGrid(ctx, w, h) {
    ctx.strokeStyle = '#e5e7eb'; // gray-200
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 20) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += 20) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();
}
