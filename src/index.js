const folder = document.querySelector('input[name="folder"]');
const file = document.querySelector('input[name="file"]');
if (folder) { folder.addEventListener('change', onReadFolder, false); }
if (file) { file.addEventListener('change', onReadFolder, false); }

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
        console.log(result);
        try {

        let style = {};
        let html = ``;

        if (result.test.ada) {
          style.num = 'bg-success';
          style.font = 'bg-success';
          style.ada = 'bg-success';
          style.stroke = 'bg-success';
          style.body = 'bg-success';
        } else {
          style.ada = test(result.test.ada);
          style.stroke = test(result.test.stroke);
          style.body = test(result.test.body);
        }

          html = `
            <tr class="${result.test.ada}">
              <td class="${style.font}">${result.name}</td>
              <td class="${style.ada}">${passFail(result.test.ada)}</td>
              <td class="${style.stroke}">${result.stroke.ratio}%</td>
              <td class="${style.body}">${result.body.ratio}%</td>
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
  } catch(err) {
    console.error("ADA Results Error");
  }
}

function passFail(testName) {
  return testName ? ["Pass"] : ["Fail"];
}

function clearFonts() {
  document.getElementById("data").innerHTML = "";
}

function downloadCSV() {
  const rows = document.querySelectorAll("table tr");
  let csvContent = "data:text/csv;charset=utf-8,";
  const today = new Date();
  const date = today.getFullYear().toString().padStart(2, '0') + (today.getMonth() + 1).toString().padStart(2, '0') + today.getDate().toString().padStart(2, '0');
  const uuid = generateUUID();
  const fileName = `adafontcheck-${date}-${uuid}.csv`;

  rows.forEach(function (row) {
    const rowData = [];
    const cols = row.querySelectorAll("th, td");

    cols.forEach(function (col) {
      rowData.push(col.innerText);
    });

    csvContent += rowData.join(",") + "\r\n";
  });

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

function toggleADAOnly() {
  const falseRows = document.querySelectorAll('tr.false');
  falseRows.forEach(row => {
    if (row.style.visibility === 'collapse') {
      row.style.visibility = 'visible';
    } else {
      row.style.visibility = 'collapse';
    }
  });
}
