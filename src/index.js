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
        const result = checkfont(font); // ERROR HERE
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
              <td>${result.name}</td>
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

function clearFonts() { document.getElementById("data").innerHTML = ""; }

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
    '', '', '', 'FEDERAL CHARACTER TESTS', '', 'CALIFORNIA CHARACTER TESTS', ''
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
