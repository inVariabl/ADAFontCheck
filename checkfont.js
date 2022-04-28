// ADA Font Check - Determines if a font meets ADA Font Requirements
// Created by Daniel Crooks
// github.com/inVariabl/ADAFontCheck

function checkfont(font) {
  const strokeMinimum = 10,
  strokeMaximum = 15,
  bodyMinimum = 60,
  bodyMaximum = 100;

  // Tests
  // Pre-Requisites
  function not_italicTest() {
    if (!/italic/gi.test(font.names.fontSubfamily.en)) { // Doesn't contain 'italic'
      return true; // Font is not italic
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

  function removeUndefined(array) {
    var j = array.indexOf(undefined);
    array.splice(j, j);
  }
  function lowestToHighest(array) {
    array.sort(function(a, b) {
      return a - b;
    });
  }
  function removeDuplicates(array) {
    return array.filter(function(item, pos) {
      return array.indexOf(item) === pos;
    });
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

  /* letter O */ // TTF = 'L', OTF = 'C'
  var letter_o_coor = font.getPath('O', 0, 150, 72).commands;
  getGlyphs('O');
  var o_x_vals = [];
  var o_y_vals = [];

  for (let i = 0; i < letter_o_coor.length; i++) {
    if (letter_o_coor[i].type === 'L') {
      o_x_vals.push(letter_o_coor[i].x);
      o_y_vals.push(letter_o_coor[i].y);
    } else if (letter_o_coor[i].type === 'C') {
      o_x_vals.push(letter_o_coor[i].x);
      o_y_vals.push(letter_o_coor[i].y);
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

  function bodyTest() {
    return bodyAverage >= bodyMinimum && bodyAverage <= bodyMaximum;
  }
  function adaTest() {
    if (strokeTest() && bodyTest() && not_italicTest()) {
      return true;
    } else {
      return false;
    }
  }

    var font_details = {
      name: font.names.fullName,
      weight: font.names.fontSubfamily.en,
      letter_i: {
        x: i_x_vals_nd,
        y: i_y_vals_nd,
        width: i_width,
        height: i_height,
        ratio: s_ratio.toFixed(2),
      },
      letter_h: {
        x: h_x_vals_nd,
        y: h_y_vals_nd,
        width: h_width,
        height: h_height,
        ratio: h_ratio.toFixed(2),
      },
      letter_o: {
        x: o_x_vals_nd,
        y: o_y_vals_nd,
        width: o_width,
        height: o_height,
        ratio: o_ratio.toFixed(2),
      },
      stroke_req: {
        min: strokeMinimum,
        max: strokeMaximum,
      },
      body_req: {
        min: bodyMinimum,
        max: bodyMaximum,
      },
      test: {
        notitalic: not_italicTest(),
        stroke: strokeTest(),
        body: bodyTest(),
        ada: adaTest(),
      }
  };

  return font_details;
}
