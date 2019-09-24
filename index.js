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
      console.log(result);
    } catch (err) {
      alert("Error!")
    }
  };
  reader.onerror = function(err) {
  };

  reader.readAsArrayBuffer(file);
}
