console.log("Starting ADA Font Check...");
const input = document.querySelector('input[type="file"]');
input.addEventListener('change', onReadFile, false);

function checkFileType() {
  if (input.files[0].type == "font/ttf" || input.files[0].type == "font/otf") {
    return true;
  } else {
    alert("ADA Font Checker can't read this filetype");
    return false;
  }
}

function onReadFile(e) {
  document.getElementById('font-name').innerHTML = '';
  var file = e.target.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      font = opentype.parse(e.target.result);
      result = checkfont(font);
      displayResults();
      //document.getElementByClassName("raw").innerHTML = JSON.stringify(result);
      //console.log(result);
    } catch (err) {
      alert("Caught Error!")
    }
  };
  reader.onerror = function(err) {};

  reader.readAsArrayBuffer(file);
}

function displayResults() {

  function adaresult() {
    if (result.test.ada) {
      return ["Pass", "pass"];
    } else if (result.test.ada === false) {
      return ["Fail", "fail"];
    } else {
      alert("Error! ADA results error.");
    }
  }
  document.getElementById('results').innerHTML += '<div id="fontresult" class='+ adaresult()[1] +'><i id="fontname">' + result.name + '</i><b id="result">' + adaresult()[0] + '</b></div>';
}
