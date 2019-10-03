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
      document.getElementById("fontname").innerHTML = result.name;
      if (result.test.ada === true) {
        document.getElementById("result").innerHTML = "Pass";
        document.getElementById("fontresult").className = "pass";

      } else if (result.test.ada === false) {
        document.getElementById("result").innerHTML = "Fail";
        document.getElementById("fontresult").className = "fail";
      } else {
        alert("Error! ADA results error.")
      }
      //document.getElementByClassName("raw").innerHTML = JSON.stringify(result);
      //console.log(result);
    } catch (err) {
      alert("Caught Error!")
    }
  };
  reader.onerror = function(err) {
  };

  reader.readAsArrayBuffer(file);
}
