console.log("Starting ADA Font Check...");
var folder = document.querySelector('input[name="folder"]');
var file = document.querySelector('input[name="file"]');
folder.addEventListener('change', onReadFolder, false);
file.addEventListener('change', onReadFile, false);

function onReadFolder(e) {
  var fontFiles = e.target.files;
  for (var i = 0; i < fontFiles.length; i++) {
    var file = fontFiles[i];
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var font = opentype.parse(e.target.result);
        var result = checkfont(font);

        document.getElementById('fonttable').innerHTML += '<tr id="tableresults" class=' + adaresult(result.test.ada)[1] + '><td class="row"><a href="#" onclick="moreFontInfo(result)">' + " " + result.name.en + '</a></td><td class="row">' + adaresult(result.test.ada)[0] + '</td></tr>';
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
        document.getElementById('fonttable').innerHTML += '<tr id="tableresults" class=' + adaresult(result.test.ada)[1] + '><td class="row">' + result.name.en + '</a></td><td class="row">' + adaresult(result.test.ada)[0] + '</td></tr> <tr><td>Not Italic</td><td>' + result.test.notitalic + '</td></tr><tr><td>Stroke Test</td><td>' + result.test.stroke + '</td></tr><tr><td>Body Test</td><td>' + result.test.body + '</td></tr><tr><td>Letter I Ratio</td><td>' + result.letter_i.ratio + '</td></tr><tr><td>Letter H Ratio</td><td>' + result.letter_h.ratio + '</td></tr><tr><td>Letter O Ratio</td><td>' + result.letter_o.ratio + '</td></tr>';

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
    return ["✔", "pass"];
  } else if (result === false) {
    if (document.getElementById("checkbox").checked === false) {
      return ["✘", "fail"];
    }
  } else {
    alert("Error! ADA results error.");
  }
}

function clearFonts() {
  document.getElementById('fonttable').innerHTML = "<tr class='tablehead'><th>Font Name</th><th>Test Results</th></tr>";
}
