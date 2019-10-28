console.log("Starting ADA Font Check...");
var input = document.querySelector('input[type="file"]');
input.addEventListener('change', onReadFile, false);

function onReadFile(e) {
  var fontFiles = e.target.files;
  for (var i = 0; i < fontFiles.length; i++) {
    var file = fontFiles[i];
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var font = opentype.parse(e.target.result);
        var result = checkfont(font);
        function adaresult() {
          if (result.test.ada) {
            return ["✔", "pass"];
          } else if (result.test.ada === false) {
            return ["✘", "fail"];
          } else {
            alert("Error! ADA results error.");
          }
        }
        //document.getElementById('results').innerHTML += '<div id="fontresult" class=' + adaresult()[1] + '><nobr id="fontname">' + result.name.en + '</nobr><b id="result">' + adaresult()[0] + '</b></div>';
        document.getElementById('fonttable').innerHTML += '<tr id="tableresults" class=' + adaresult()[1] + '><td>' + result.name.en + '</td><td>' + adaresult()[0] + '</td></tr>';
        //displayResults();
      } catch (err) {
        console.log("Caught Error!");
        return false;
      }
    };
    reader.onerror = function(err) {};
    reader.readAsArrayBuffer(file);
  }
}

function displayResults() {
  function adaresult() {
    if (result.test.ada) {
      return ["✔", "pass"];
    } else if (result.test.ada === false) {
      return ["✘", "fail"];
    } else {
      alert("Error! ADA results error.");
    }
  }
  console.log(adaresult());
  //document.getElementById('results').innerHTML += '<div id="fontresult" class=' + adaresult()[1] + '><i id="fontname">' + input.files[i].name + '</i><b id="result">' + adaresult()[0] + '</b></div>';
}
