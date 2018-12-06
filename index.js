// ADA Font Check
// Determines if a font meets ADA Font Requirements
// Created by Daniel Crooks

const opentype = require('opentype.js'),
  fs = require('fs'),
  path = require('path'),
  fastcsv = require('fast-csv');
//flags = require('flags'),
//express = require('express'),
//commander = require('commander');

let strokemin = 10;
  strokemax = 20,
  bodymin = 60,
  bodymax = 100,

/* >to become flags */
  //verbose = true,
  verbose = false,
  //small = false,
  small = true,
  allfont = [];
  outputToCSV = true;
  crawlDir = false;

// Recursively searches directories, returning filenames
function crawl(dir) {
  let files = fs.readdirSync(dir)
  for (var x in files) {
    let next = path.join(dir, files[x]);
    if (fs.lstatSync(next).isDirectory()) {
      crawl(next);
    } else if (//.test(next) === false) {
      let stats = fs.statSync(next).size;
      console.log(stats);
      allfont.push(next);
    }
  }
}

function


function checkfont(fontname) {

  let font = opentype.loadSync(fontname);
  let font_name = font.names.fontFamily.en;

  function verboselog() {

    console.log("> Font Information" + '\n' + "Name: " + font_name + '\n' + "Weight: " + font.names.fontSubfamily.en + '\n');
    console.log("> Stroke Test" + '\n' + ">> Letter 'I'");
    printxy(i_x_vals_nd, i_y_vals_nd);

    console.log("Width: " + i_width + '\n' + "Height: " + i_height)
    printreq(strokemin, strokemax, "Stroke");
    console.log("Stroke Width Ratio: " + s_ratio + '\n');
    results(s_test, "Stroke Width");

    console.log("> Body Weight Test");
    console.log(">> Letter 'H'");
    printxy(h_x_vals_nd, h_y_vals_nd);
    console.log("Width: " + h_width + '\n' + "Height: " + h_height);
    printreq(bodymin, bodymax, "Body");
    console.log("Body Width Ratio: " + h_ratio + '\n');
    if (sans_serif) {
      console.log("!!! Error: " + "'" + font_name + "'" + " is not Sans-Serif.");
      return false;
    }
    results(b_test, "Body Width");

    console.log(">> Letter 'O'");
    printxy(o_x_vals_nd, o_y_vals_nd);
    console.log("Body Width Ratio: " + o_ratio + '\n');
    printreq(bodymin, bodymax, "Body");
    console.log("Width: " + o_width + '\n' + "Height: " + o_height);
    console.log("Average Body Ratio: " + bodyavg);
    endResults(ada_test);

  }

  function minlog() {
    //results(s_test, "Stroke Width");
    //results(b_test, "Body Width");
    endResults(ada_test);
  }

  function csvOutput() {
    // CSV Output
    let output = fs.createWriteStream('test.csv');

    fastcsv.write([

      ["1", "2"],
      ["3", "4"].commands

    ], {
      headers: true
    }).pipe(output);

    console.log("Outputed to CSV file");
  }

  function no_italic() {
    if (/italic/gi.test(font.names.fontSubfamily.en)) {
      console.log("!!! Error: Italic Fonts do not comply with ADA standards." + '\n' + "!!! If the font is not Italic, please check and/or edit font metadata.");
      return false;
    }
  }

  no_italic();

  /* Stroke Width / Height Ratio Test */
  let letter_i_coor = font.getPath('I', 0, 150, 72).commands;
  let i_x_vals = [];
  let i_y_vals = [];

  function toArray(letter_obj, x_array, y_array) {
    for (var i = 0; i < letter_obj.length; i++) {
      x_array.push(letter_obj[i].x);
      y_array.push(letter_obj[i].y);
    }
  }

  toArray(letter_i_coor, i_x_vals, i_y_vals);

  function removeUndefined(array) {
    let j = array.indexOf(undefined);
    array.splice(j, j);
  }

  function lowestToHighest(array) {
    array.sort(function(a, b) {
      return a - b
    });
  }

  removeUndefined(i_x_vals);
  removeUndefined(i_y_vals);
  lowestToHighest(i_x_vals);
  lowestToHighest(i_y_vals);


  // Remove Duplicate Numbers in array
  i_x_vals_nd = i_x_vals.filter(function(item, pos) {
    return i_x_vals.indexOf(item) === pos;
  });
  i_y_vals_nd = i_y_vals.filter(function(item, pos) {
    return i_y_vals.indexOf(item) === pos;
  });


  // Remove baseline and top Serifs for the "I"
  if (i_x_vals_nd.length === 4 && i_y_vals_nd.length === 4) {
    i_x_vals_nd.pop();
    i_x_vals_nd.splice(0, 1);
    i_y_vals_nd.splice(1, 1);
    i_y_vals_nd.splice(1, 1);
  }

  if (i_x_vals_nd.length === 2 && i_y_vals_nd.length === 2) {
    var i_width = i_x_vals_nd[1] - i_x_vals_nd[0];
    var i_height = i_y_vals_nd[1] - i_y_vals_nd[0];
  }

  let s_ratio = (i_width / i_height) * 100;


  if (s_ratio >= strokemin && s_ratio <= strokemax) {
    //console.log("*** Passed! - Stroke Width Test" + '\n');
    var s_test = true;
  } else if (s_ratio < strokemin || s_ratio > strokemax) {
    var s_test = false;
    return false;
  }

  function results(test, name) {
    if (test) {
      console.log("*** Passed! - " + name + "\n");
    } else if (test === false) {
      console.log("!!! Failed - " + name + "\n");
    } else {
      console.error("Results does not have a boolean");
    }
  }

  function endResults(test, name) {
    if (test) {
      console.log("+ " + "'" + font_name + "'" + " - Passed");
    } else if (test === false) {
      console.log("- " + "'" + font_name + "'" + " - Failed");
    } else {
      console.error("endResults != boolean");
    }
  }

  /* Body Width / Height Ratio Test */
  // Letter 'H'
  let letter_h_coor = font.getPath('H', 0, 150, 72).commands;

  let h_x_vals = [];
  let h_y_vals = [];

  toArray(letter_h_coor, h_x_vals, h_y_vals);

  removeUndefined(h_x_vals);
  removeUndefined(h_y_vals);
  lowestToHighest(h_x_vals);
  lowestToHighest(h_y_vals);

  // Remove Duplicate Numbers in array
  h_x_vals_nd = h_x_vals.filter(function(item, pos) {
    return h_x_vals.indexOf(item) === pos;
  });
  h_y_vals_nd = h_y_vals.filter(function(item, pos) {
    return h_y_vals.indexOf(item) === pos;
  });

  function printxy(x, y, height, width) {
    console.log("X-Values: " + x + '\n' + "Y-Values: " + y);
  }

  let h_height = h_y_vals[h_y_vals.length - 1] - h_y_vals[0];
  let h_width = h_x_vals[h_x_vals.length - 1] - h_x_vals[0];

  function printreq(min, max, type) {
    console.log("ADA " + type + " Requirements: " + min + "%" + " - " + max + "%");
  }


  if (h_x_vals_nd.length === 4 && h_y_vals_nd.length === 4) {
    var h_ratio = (h_width / h_height) * 100;
  } else if (h_x_vals_nd.length > 4 && h_y_vals_nd.length > 4) {
    var sans_serif = false;
    return false;
  }

  /* Letter O */
  let letter_o_coor = font.getPath('O', 0, 150, 72).commands;
  let o_x_vals = [];
  let o_y_vals = [];

  for (var i = 0; i < letter_o_coor.length; i++) {
    if (letter_o_coor[i].type === 'L') {
      o_x_vals.push(letter_o_coor[i].x)
      o_y_vals.push(letter_o_coor[i].y)
    }
  }

  removeUndefined(o_x_vals);
  removeUndefined(o_y_vals);
  lowestToHighest(o_x_vals);
  lowestToHighest(o_y_vals);

  // Remove Duplicate Numbers in array
  o_x_vals_nd = o_x_vals.filter(function(item, pos) {
    return o_x_vals.indexOf(item) === pos;
  });
  o_y_vals_nd = o_y_vals.filter(function(item, pos) {
    return o_y_vals.indexOf(item) === pos;
  });


  let o_height = o_y_vals[o_y_vals.length - 1] - o_y_vals[0];
  let o_width = o_x_vals[o_x_vals.length - 1] - o_x_vals[0];
  let o_ratio = (o_width / o_height) * 100;
  var bodyavg = (h_ratio + o_ratio) / 2;

  if (bodyavg >= bodymin && bodyavg <= bodymax) {
    //console.log("*** Passed! - Body Test");
    var b_test = true;
  } else {
    //console.log("!!! Failed! - Body Test");
    var b_test = false;
    return false;
  }

  if (s_test && b_test) {
    //console.log("### " + "'" + font_name + "'" + " Meets ADA Requirements!" + '\n');
    var ada_test = true;
  }

  if (verbose) {
    verboselog();
  }

  if (small) {
    minlog();
  }

  return false;

}

//for (var i = 0; i < 1000; i++) { /* Performance Testing */
//checkfont('Fonts/Roboto/Roboto-Black.ttf');
//checkfont('Fonts/Roboto_Mono/RobotoMono-Bold.ttf');

//let allfont = crawl("Fonts");

if (crawlDir) {
  crawl("Fonts");
  console.log(allfont);
}


//checkfont("Fonts/Acumin Pro/._AcuminPro-Black.otf");
//checkfont("Fonts/Acumin Pro/AcuminPro-Black.otf");
/*for (var i = 0; i < allfont.length; i++) {
  checkfont(allfont[i]);
}*/


//checkfont('Fonts/Roboto_Mono/RobotoMono-Regular.ttf');

// Serifs
//checkfont('Fonts/Merriweather/Merriweather-Black.ttf');

// Outliers
//checkfont('Fonts/Alegreya\ Sans/Unknown/AlegreyaSans\ Black.otf');
//checkfont('Fonts/Fontin\ Sans/Unknown/FontinSans\ Bold.otf');
//checkfont('Fonts/K2D/K2D-Bold.ttf');
//checkfont('Fonts/Mali/Mali-Bold.ttf');
//checkfont('Fonts/Rosario/Unknown/Rosario\ Bold.otf')

//checkfont('Fonts/Roboto_Mono/RobotoMono-Medium.ttf');
//checkfont('Fonts/Martel_Sans/Martelsans-Bold.otf');
//checkfont('Fonts/Roboto/Roboto-Italic.ttf');
//checkfont('Fonts/Roboto/Roboto-BoldItalic.ttf');
//checkfont('Fonts/Decalotype/Decalotype-Black.otf');
//checkfont('Fonts/Decalotype/Decalotype-Bold.otf');
//checkfont('Fonts/Fira\ Sans\ Condensed/FiraSansCondensed-Bold.otf');
//}
