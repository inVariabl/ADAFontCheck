var folder = document.querySelector('input[name="folder"]');
var file = document.querySelector('input[name="file"]');
if (folder) { folder.addEventListener('change', onReadFolder, false); }
if (file) { file.addEventListener('change', onReadFolder, false); }

function onReadFolder(e) {
  clearFonts();
  var fontFiles = e.target.files;
  for (var i = 0; i < fontFiles.length; i++) {
    var file = fontFiles[i];
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var font = opentype.parse(e.target.result);
        var result = checkfont(font);
        document.getElementById('displayresults').innerHTML += `<li><div class="collapsible-header row ${adaresult(result.test.ada)[1]}"><div class="col s11"><b>${result.name.en}</b></div> <div class="col s1">${adaresult(result.test.ada)[0] }</div></div><div class="collapsible-body row"><span></span><div class="col s10">Not Italic Test</div><div class="col s2">${test(result.test.notitalic)}</div></div><div class="collapsible-body row"><span></span> <div class="col s10">Stroke Width Test</div> <div class="col s2">${test(result.test.stroke)}</div></div><div class="collapsible-body row"><span></span> <div class="col s10">Body Width Test</div> <div class="col s2">${test(result.test.body)}</div></div><div class="collapsible-body row"><span></span><div class="col s10">Letter "I" Ratio</div> <div class="col s2">${result.letter_i.ratio + '%'}</div></div><div class="collapsible-body row"><span></span> <div class="col s10">Letter "H" Ratio</div> <div class="col s2">${result.letter_h.ratio + '%'}</div></div><div class="collapsible-body row"><span></span><div class="col s10">Letter "O" Ratio</div> <div class="col s2">${result.letter_o.ratio + '%'}</div></div></li>`;
      } catch (err) {
        console.log("Caught Error!");
        return false;
      }
    };
    reader.onerror = function(err) {};
    reader.readAsArrayBuffer(file);
  }
}

function adaresult(result) {
  if (result) { // Pass
    return ["<i class='material-icons green-text tooltipped' data-position='bottom' data-tooltip='Meets ADA Requirements'>check_circle</i>", 'green lighten-5'];
  } else if (result === false) { // Fail
    if (document.getElementById("checkbox").checked === false) {
      return ["<i class='material-icons red-text tooltipped' data-position='bottom' data-tooltip='Does not meet ADA Requirements'>cancel</i>", ''];
    }
  } else {
    alert("Error! ADA results error.");
  }
}

function test(testName) {
  if (testName) { // Pass
    return ["<i class='material-icons green-text'>check_circle</i>"];
  } else { // Fail
    return ["<i class='material-icons red-text'>cancel</i>"];
  }
}

function clearFonts() {
  console.log("Clearing Fonts");
  document.getElementById('displayresults').innerHTML = `
        <li>
          <div class="collapsible-header row green lighten-5">
            <div class="col s11"><b>Example Font 1</b></div>
            <div class="col s1"><i class="material-icons green-text tooltipped" data-position="bottom" data-tooltip="Meets ADA Requirements">check_circle</i></div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Not Italic Test</div>
            <div class="col s1"><i class="material-icons green-text">check_circle</i></div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Stroke Width Test</div>
            <div class="col s1"><i class="material-icons green-text">check_circle</i></div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Body Width Test</div>
            <div class="col s1"><i class="material-icons green-text">check_circle</i></div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Letter 'I' Ratio</div>
            <div class="col s1">10-15%</div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Letter 'H' Ratio</div>
            <div class="col s1">60-100%</div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Letter 'O' Ratio</div>
            <div class="col s1">60-100%</div>
          </div>
        </li>
        <li>
          <div class="collapsible-header row">
            <div class="col s11"><b>Example Font 2</b></div>
            <div class="col s1"><i class="material-icons red-text tooltipped" data-position="bottom" data-tooltip="Doesn't Meet ADA Requirements">cancel</i></div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Not Italic Test</div>
            <div class="col s1"><i class="material-icons red-text">cancel</i></div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Stroke Width Test</div>
            <div class="col s1"><i class="material-icons red-text">cancel</i></div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Body Width Test</div>
            <div class="col s1"><i class="material-icons red-text">cancel</i></div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Letter 'I' Ratio</div>
            <div class="col s1">30%</div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Letter 'H' Ratio</div>
            <div class="col s1">50%</div>
          </div>
          <div class="collapsible-body row"><span></span>
            <div class="col s11">Letter 'O' Ratio</div>
            <div class="col s1">40%</div>
          </div>
        </li>
`;
}
