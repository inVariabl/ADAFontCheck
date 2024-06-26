// ADA Font Check - Determines if a font meets ADA Font Requirements
// Created by Daniel Crooks
// github.com/inVariabl/ADAFontCheck

const ot = require('opentype.js');
const fs = require('fs');

function checkfont(opentype) {
  var opentype = ot.loadSync(opentype);
  const font = {
      name: opentype.names.fullName.en,
      weight: opentype.names.fontSubfamily.en,
      i: {
        x: [],
        y: [],
        width: undefined,
        height: undefined,
        ratio: undefined,
      },
      h: {
        x: [],
        y: [],
        width: undefined,
        height: undefined,
        ratio: undefined,
      },
      o: {
        x: [],
        y: [],
        width: undefined,
        height: undefined,
        ratio: undefined,
      },
      federal: {
        body: {
          min: 55,
          max: 110,
        },
        tactile: {
          min: 0,
          max: 15,
        },
        visual: {
          min: 10,
          max: 30,
        },
      },
      california: {
        body: {
          min: 60,
          max: 110,
        },
        tactile: {
          min: 0,
          max: 15,
        },
        visual: {
          min: 10,
          max: 20,
        },
      },
      stroke: {
        // min: 10,
        // max: 15,
        ratio: undefined,
      },
      body: {
        // min: 60,
        // max: 100,
        ratio: undefined,
      },
      test: {
        notitalic: null,
        sansSerif: null,
        //stroke: null,
        //body: null,
        //ada: null,
        federal: {
          tactile: null,
          visual: null,
        },
        california: {
          tactile: null,
          visual: null,
        },
      },
  };

  function not_italicTest() {
    return !/italic/gi.test(opentype.names.fontSubfamily.en);
  }

  /* Stroke Width / Height Ratio Test */
  function getGlyphs(letter) {
    return opentype.getPath(letter, 0, 150, 72).commands;
  }

  // Splitting object into separate x and y arrays
  function splitArray(letterObject, x_array, y_array) {
    for (let i = 0; i < letterObject.length; i++) {
      x_array.push(letterObject[i].x);
      y_array.push(letterObject[i].y);
    }
  }

  function splitAndFormat(coordinates, letter) {
    splitArray(coordinates, letter.x, letter.y);
    letter.x = formatArray(letter.x);
    letter.y = formatArray(letter.y);
  }

  function formatArray(array) {
    return array.filter(v => v !== undefined).sort((a, b) => a - b).filter(function(item, pos, self) {
      return self.indexOf(item) === pos;
    });
  }

  // Remove baseline and top Serifs for the "I"
  function removeBaselineAndTopSerifs(x, y) {
    if (x.length === 4 && y.length === 4) {
      x.pop();
      x.splice(0, 1);
      y.splice(1, 1);
      y.splice(1, 1);
    }

    if (x.length === 2 && y.length === 2) {
      font.i.width = x[1] - x[0];
      font.i.height = y[1] - y[0];
    }
  }

  function getSize(arr) {
    return arr[arr.length - 1] - arr[0];
  }

  function getRatio(width, height) {
    return Number(((width / height) * 100).toFixed(2));
  }

  function sansSerifTest() {
    if (font.h.x.length === 4 && font.h.y.length === 4) {
      font.h.ratio = getRatio(font.h.width, font.h.height);
      return true; // Font is Sans-Serif
    } else if (font.h.x.length > 4 && font.h.y.length > 4) {
      return false; // Font is Serif
    }
  }

  function bodyAverage() {
    return Number(((font.h.ratio + font.o.ratio) / 2).toFixed(2));
  }

  function test(min, max, ratio) {
    return ratio >= min && ratio <= max;
  }

  /* Stroke Width:Height Ratio */
  // letter 'I'
  splitAndFormat(getGlyphs('I'), font.i);
  removeBaselineAndTopSerifs(font.i.x, font.i.y);
  font.i.width = getSize(font.i.x);
  font.i.height = getSize(font.i.y);
  font.i.ratio = getRatio(font.i.width, font.i.height);
  font.stroke.ratio = font.i.ratio;

  /* Body Width:Height Ratio */
  // letter 'H'
  splitAndFormat(getGlyphs('H'), font.h);
  font.h.width = getSize(font.h.x);
  font.h.height = getSize(font.h.y);
  font.h.ratio = getRatio(font.h.width, font.h.height);

  // letter 'O'
  splitAndFormat(getGlyphs('O').filter(c => c.type === 'L' || c.type === 'C'), font.o);
  font.o.width = getSize(font.o.x);
  font.o.height = getSize(font.o.y);
  font.o.ratio = getRatio(font.o.width, font.o.height);

  font.test.sansSerif = sansSerifTest();
  font.test.notitalic = not_italicTest();
  font.body.ratio = bodyAverage();

  function standardsTest(bodyMin, bodyMax, bodyRatio, strokeMin, strokeMax, strokeRatio) { // california or federal
    if (font.test.sansSerif && font.test.notitalic) {
      if (test(bodyMin, bodyMax, bodyRatio)) {
        return test(strokeMin, strokeMax, strokeRatio);
      }
    }
    return false;
  }

  font.test.federal.tactile = standardsTest(font.federal.body.min, font.federal.body.max, font.body.ratio, font.federal.tactile.min, font.federal.tactile.max, font.stroke.ratio);
  font.test.federal.visual = standardsTest(font.federal.body.min, font.federal.body.max, font.body.ratio, font.federal.visual.min, font.federal.visual.max, font.stroke.ratio);
  font.test.california.tactile = standardsTest(font.california.body.min, font.california.body.max, font.body.ratio, font.california.tactile.min, font.california.tactile.max, font.stroke.ratio);
  font.test.california.visual = standardsTest(font.california.body.min, font.california.body.max, font.body.ratio, font.california.visual.min, font.california.visual.max, font.stroke.ratio);

  console.log(font);
  return font;
}

//checkfont('../Fonts/Roboto/Roboto-Regular.ttf');
// Get the file path from the command-line arguments
for (let i = 2; i < process.argv.length; i++) {
   const filePath = process.argv[i];
   checkfont(filePath);
}
