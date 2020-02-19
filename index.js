console.log("Starting ADA Font Check...");
var folder = document.querySelector('input[name="folder"]');
var file = document.querySelector('input[name="file"]');
if (folder) {
  folder.addEventListener('change', onReadFolder, false);
}
if (file) {
  file.addEventListener('change', onReadFile, false);
}

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
        console.log(result);
        document.getElementById('displayresults').innerHTML += '<li> <div class="collapsible-header row ' + adaresult(result.test.ada)[1] + '"> <div class="col s11"><b>' + result.name.en + '</b></div> <div class="col s1">' + adaresult(result.test.ada)[0] + '</div> </div> <div class="collapsible-body row"><span></span> <div class="col s11">Not Italic Test</div> <div class="col s1">' + result.test.notitalic + '</div> </div> <div class="collapsible-body row"><span></span> <div class="col s10">Stroke Width Test</div> <div class="col s2">' + result.test.stroke + '</div> </div> <div class="collapsible-body row"><span></span> <div class="col s10">Body Width Test</div> <div class="col s2">' + result.test.body + '</div> </div> <div class="collapsible-body row"><span></span> <div class="col s10">Letter "I" Ratio</div> <div class="col s2">' + result.letter_i.ratio + '</div> </div> <div class="collapsible-body row"><span></span> <div class="col s10">Letter "H" Ratio</div> <div class="col s2">' + result.letter_h.ratio + '</div> </div> <div class="collapsible-body row"><span></span> <div class="col s10">Letter "O" Ratio</div> <div class="col s2">' + result.letter_o.ratio + '</div> </div> </li>';
      } catch (err) {
        console.log("Caught Error!");
        return false;
      }
    };
    reader.onerror = function(err) {};
    reader.readAsArrayBuffer(file);
  }
}

function onReadFile(e) {
  var fontFiles = e.target.files;
  for (var i = 0; i < fontFiles.length; i++) {
    var file = fontFiles[i];
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var font = opentype.parse(e.target.result);
        var result = checkfont(font);
        document.getElementById('fonttable').innerHTML += '<tbody><tr class=' + adaresult(result.test.ada)[1] + ' id="tableresults" ><td class="row">' + result.name.en + '</a></td><td class="row">' + adaresult(result.test.ada)[0] + '</td></tr> <tr><td>Not Italic</td><td>' + result.test.notitalic + '</td></tr><tr><td>Stroke Test</td><td>' + result.test.stroke + '</td></tr><tr><td>Body Test</td><td>' + result.test.body + '</td></tr><tr><td>Letter I Ratio</td><td>' + result.letter_i.ratio + '</td></tr><tr><td>Letter H Ratio</td><td>' + result.letter_h.ratio + '</td></tr><tr><td>Letter O Ratio</td><td>' + result.letter_o.ratio + '</td></tr></tbody>';
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
  if (result) {
    //return ["✔", "pass"];
    return ["<i class='material-icons green-text tooltipped' data-position='bottom' data-tooltip='Meets ADA Requirements'>check_circle</i>", 'green lighten-5'];
  } else if (result === false) {
    if (document.getElementById("checkbox").checked === false) {
      //return ["✘", "fail"];
      return ["<i class='material-icons red-text tooltipped' data-position='bottom' data-tooltip='Does not meet ADA Requirements'>cancel</i>", ""];
    }
  } else {
    alert("Error! ADA results error.");
  }
}

function clearFonts() {
  console.log("Clearing Fonts");
  document.getElementById('displayresults').innerHTML = "";
}
