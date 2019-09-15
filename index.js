console.log("Starting ADA Font Check...");
const input = document.querySelector('input[type="file"]');
//const input = document.getElementById('font-name');
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
  if (checkFileType()) {
    console.log("working");
  }
  var file = e.target.files[0];
  var reader = new FileReader();
  reader.onload = function (e) {
  try {
    var font = opentype.parse(e.target.result);
    console.log(font);
  } catch (err) {
    console.log("error");
  }
};
}
