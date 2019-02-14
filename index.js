// ADA Font Check - Determines if a font meets ADA Font Requirements
// Created by Daniel Crooks
// github.com/inVariabl/ADAFontCheck

const opentype = require('opentype.js'),
  fs = require('fs'),
  path = require('path'),
  glob = require('glob'),
  fastcsv = require('fast-csv');
//  flags = require('flags'),
//  commander = require('commander');
//  express = require('express'),

var strokeMinimum = 10,
  strokeMaximum = 20,
  bodyMinimum = 60,
  bodyMaximum = 100;

/* >to become flags */

function checkfont(fontname) {
  var font = opentype.loadSync(fontname);
  var font_name = font.names.fontFamily.en;

  function output(prefix, name, value) {
    // e.g. > Stroke Width Ratio:    15%
    if (value === undefined) {
      console.log(prefix + " " + name);
    } else {
      console.log(prefix + " " + name + ":" + '\t' + value);
    }
  }

  function outputRequirements(min, max, type) {
    console.log("> ADA " + type + " Requirements: " + '\t' + min + "%" + " - " + max + "%");
  }

  function test(testname, results, passMessage, failMessage) {
    if (results === true) {
      // e.g. > Stroke Width Test:    Passed!
      console.log("*** " + testname + " Test:" + '\t' + "Passed!");
      if (passMessage !== undefined) {
        console.log("*** " + passMessage);
      }
    } else if (results !== true) {
      console.log("!!! " + testname + " Test:" + '\t' + "Failed!");
      if (failMessage !== undefined) {
        console.log("!!! " + failMessage);
      }
      return;
    } else {
      console.error("test function error");
    }
  }

  // Outputs
  function verboseOutput() {

    output(">", "Font Information");
    output("", "Name", font_name);
    output("", "Weight", font.names.fontSubfamily.en);
    //test("Italic", italic, "Font is not Italic", "Font is Italic");
    test("Italic", not_italicTest());

    function outputLetter(name, letter, xvals, yvals, width, height, min, max, ratio, testname) {
      output(">", name + " Width Test");
      output("", "Letter '" + letter + "'");
      output("", "X-Values", xvals);
      output("", "Y-Values", yvals);
      output("", "Width", width);
      output("", "Height", height);
      outputRequirements(min, max, name);
      output(">", name + " Width Ratio", ratio);
      test(name + " Width", testname);
    }

    outputLetter("Stroke", "I", i_x_vals_nd, i_y_vals_nd, i_width, i_height, strokeMinimum, strokeMaximum, s_ratio, strokeTest());
    outputLetter("Body", "H", h_x_vals_nd, h_y_vals_nd, h_width, h_height, bodyMinimum, bodyMaximum, h_ratio, bodyTest());
    outputLetter("Body", "O", o_x_vals_nd, o_y_vals_nd, o_width, o_height, bodyMinimum, bodyMaximum, o_ratio, bodyTest());
    output("", "Average Body Ratio", bodyAverage);
    test("ADA Font Final", adaTest());

  }

  function minimalOutput() {
    if (adaTest) {
      // e.g. + 'Roboto Mono' - Passed!
      console.log("+ " + "'" + font_name + "'" + " - " + "Passed!");
      return;
    } else {
      console.log("+ " + "'" + font_name + "'" + " - " + "Failed!");
      return;
    }
  }

  // Tests
  // Pre-Requisites
  function not_italicTest() {
    if (!/italic/gi.test(font.names.fontSubfamily.en)) { // Doesn't contain 'italic'
      return true; // Font is italic
    }
  }

  /* Stroke Width / Height Ratio Test */
  function getGlyphs(letter) {
    return font.getPath(letter, 0, 150, 72).commands;
  }
  getGlyphs('I');
  var letter_i_coor = font.getPath('I', 0, 150, 72).commands;
  var i_x_vals = [];
  var i_y_vals = [];

  function splitArray(letterObject, x_array, y_array) {
    for (let i = 0; i < letterObject.length; i++) {
      x_array.push(letterObject[i].x);
      y_array.push(letterObject[i].y);
    }
  }

  splitArray(letter_i_coor, i_x_vals, i_y_vals);

  console.log(letter_i_coor);

  function removeUndefined(array) {
    var j = array.indexOf(undefined);
    array.splice(j, j);
  }
  function lowestToHighest(array) {
    array.sort(function(a, b) {
      return a - b
    });
  }
  function removeDuplicates(array) {
    return array.filter(function(item, pos) {
      return array.indexOf(item) === pos;
    })
  }
  function modifyArray(x_vals, y_vals) {
    removeUndefined(x_vals);
    removeUndefined(y_vals);
    lowestToHighest(x_vals);
    lowestToHighest(y_vals);
  }

  modifyArray(i_x_vals, i_y_vals);

  var i_x_vals_nd = removeDuplicates(i_x_vals);
  var i_y_vals_nd = removeDuplicates(i_y_vals);

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

  var s_ratio = (i_width / i_height) * 100;

  function strokeTest() {
    if (s_ratio >= strokeMinimum && s_ratio <= strokeMaximum) {
      return true;
    } else if (s_ratio < strokeMinimum || s_ratio > strokeMaximum) {
      return false;
    }
  }

  /* Body Width / Height Ratio Test */
  // letter 'H'
  var letter_h_coor = font.getPath('H', 0, 150, 72).commands;

  getGlyphs('H');
  var h_x_vals = [];
  var h_y_vals = [];

  splitArray(letter_h_coor, h_x_vals, h_y_vals);

  removeUndefined(h_x_vals);
  removeUndefined(h_y_vals);
  lowestToHighest(h_x_vals);
  lowestToHighest(h_y_vals);

  var h_x_vals_nd = removeDuplicates(h_x_vals);
  var h_y_vals_nd = removeDuplicates(h_y_vals);

  var h_height = h_y_vals[h_y_vals.length - 1] - h_y_vals[0];
  var h_width = h_x_vals[h_x_vals.length - 1] - h_x_vals[0];

  if (h_x_vals_nd.length === 4 && h_y_vals_nd.length === 4) {
    var h_ratio = (h_width / h_height) * 100;
    var sanserifTest = true; // Font is Sans-Serif
  } else if (h_x_vals_nd.length > 4 && h_y_vals_nd.length > 4) {
    var sanserifTest = false; // Font is Serif
  }

  /* letter O */
  // TTF = 'L'
  // OTF = 'C'
  var letter_o_coor = font.getPath('O', 0, 150, 72).commands;
  getGlyphs('O');
  var o_x_vals = [];
  var o_y_vals = [];

  for (let i = 0; i < letter_o_coor.length; i++) {
    if (letter_o_coor[i].type === 'L') {
      o_x_vals.push(letter_o_coor[i].x)
      o_y_vals.push(letter_o_coor[i].y)
    } else if (letter_o_coor[i].type === 'C') {
      o_x_vals.push(letter_o_coor[i].x)
      o_y_vals.push(letter_o_coor[i].y)
    }
  }

  removeUndefined(o_x_vals);
  removeUndefined(o_y_vals);
  lowestToHighest(o_x_vals);
  lowestToHighest(o_y_vals);
  var o_x_vals_nd = removeDuplicates(o_x_vals);
  var o_y_vals_nd = removeDuplicates(o_y_vals);

  var o_height = o_y_vals[o_y_vals.length - 1] - o_y_vals[0];
  var o_width = o_x_vals[o_x_vals.length - 1] - o_x_vals[0];
  var o_ratio = (o_width / o_height) * 100;
  var bodyAverage = (h_ratio + o_ratio) / 2;

  //console.log("Stroke: " + strokeTest());
  //console.log("Body: " + bodyTest());
  //console.log("ADA Test: " + adaTest());

  console.log('\n' + "*---------------------------------------------*" + '\n');

  function bodyTest() {
    return bodyAverage >= bodyMinimum && bodyAverage <= bodyMaximum;
  }
  function adaTest() {
    if (strokeTest && bodyTest) {
      return true;
    }
  }
  verboseOutput();
  //minimalOutput();

  return;
}

//checkfont('Fonts/Roboto_Mono/RobotoMono-Regular.ttf'); // Passes

//var fontfolder = [];
//var fontfolder = lsdir('Fonts/');
//console.log(fontlist);

/*for (var i = 0; i < fontfolder.length; i++) {
  checkfont[i];
}*/

// Serifs
checkfont('Fonts/Merriweather/Merriweather-Black.ttf');

// Outliers
//checkfont('Fonts/Alegreya\ Sans/Unknown/AlegreyaSans\ Black.otf');
//checkfont('Fonts/Fontin\ Sans/Unknown/FontinSans\ Bold.otf');
//checkfont('Fonts/K2D/K2D-Bold.ttf');
//checkfont('Fonts/Mali/Mali-Bold.ttf');
//checkfont('Fonts/Rosario/Unknown/Rosario\ Bold.otf')
//checkfont('Fonts/Roboto_Mono/RobotoMono-Medium.ttf'); // Passed
//checkfont('Fonts/Martel_Sans/Martelsans-Bold.otf');
//checkfont('Fonts/Roboto/Roboto-Italic.ttf');
//checkfont('Fonts/Roboto/Roboto-BoldItalic.ttf');
//checkfont('Fonts/Decalotype/Decalotype-Black.otf');
//checkfont('Fonts/Decalotype/Decalotype-Bold.otf');
//checkfont('Fonts/Fira\ Sans\ Condensed/FiraSansCondensed-Bold.otf');
