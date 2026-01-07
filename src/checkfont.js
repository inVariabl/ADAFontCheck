// ADA Font Check - Determines if a font meets ADA Font Requirements
// Created by Daniel Crooks
// github.com/inVariabl/ADAFontCheck

function checkfont(opentype) {
  const font = {
    original: opentype,
    name : opentype.names.fullName.en,
    weight : opentype.names.fontSubfamily.en,
    i : {
      x : [],
      y : [],
      width : undefined,
      height : undefined,
      ratio : undefined,
    },
    h : {
      x : [],
      y : [],
      width : undefined,
      height : undefined,
      ratio : undefined,
    },
    o : {
      x : [],
      y : [],
      width : undefined,
      height : undefined,
      ratio : undefined,
    },
    federal : {
      body : {
        min : 55,
        max : 110,
      },
      tactile : {
        min : 0,
        max : 15,
      },
      visual : {
        min : 10,
        max : 30,
      },
    },
    california : {
      body : {
        min : 60,
        max : 110,
      },
      tactile : {
        min : 0,
        max : 15,
      },
      visual : {
        min : 10,
        max : 20,
      },
    },
    stroke : {
      // min: 10,
      // max: 15,
      ratio : undefined,
    },
    body : {
      // min: 60,
      // max: 100,
      ratio : undefined,
    },
    test : {
      notitalic : null,
      sansSerif : null,
      // stroke: null,
      // body: null,
      // ada: null,
      federal : {
        tactile : null,
        visual : null,
      },
      california : {
        tactile : null,
        visual : null,
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
    return array.filter(v => v !== undefined)
        .sort((a, b) => a - b)
        .filter(function(item, pos,
                         self) { return self.indexOf(item) === pos; });
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

  function getSize(arr) { return arr[arr.length - 1] - arr[0]; }

  function getRatio(width, height) {
    return Number(((width / height) * 100).toFixed(2));
  }

  function isSansSerif(font) {
    // This is terrible practice
    const serifIndicators =
        [ /serif/gi, /times/gi, /georgia/gi, /garamond/gi, /baskerville/gi ];
    const sansSerifIndicators =
        [ /sans/gi, /helvetica/gi, /arial/gi, /verdana/gi, /futura/gi ];
    const fontName = font.names.fullName.en.toLowerCase();

    if (serifIndicators.some(regex => regex.test(fontName))) {
      // console.log(`Metadata check: Classified as serif due to name "${
      // font.names.fullName.en}"`);
      return false;
    }
    if (sansSerifIndicators.some(regex => regex.test(fontName))) {
      // console.log(`Metadata check: Classified as sans-serif due to name "${
      // font.names.fullName.en}"`);
      return true;
    }

    let serifLikeCount = 0;
    let totalChecked = 0;
    const debugInfo = {};

    // const testGlyphs = ['I', 'i', 'l', 'T', 'E'];
    const testGlyphs = [ 'A', 'E', 'H', 'B', 'G' ];

    for (let char of testGlyphs) {
      let glyph;
      try {
        glyph = font.charToGlyph(char);
      } catch (e) {
        continue;
      }

      if (!glyph.path || !glyph.path.commands.length)
        continue;

      const bounds = glyph.getBoundingBox();
      const verticalEdges = detectVerticalStems(glyph.path.commands, font);

      debugInfo[char] = {
        hasSerif :
            hasSerifProtrusions(glyph.path.commands, bounds, verticalEdges)
      };
      if (debugInfo[char].hasSerif) {
        serifLikeCount++;
      }
      totalChecked++;
    }

    // console.log(`isSansSerif Debug for ${font.names.fullName.en}:`,
    // debugInfo, {serifLikeCount, totalChecked});
    return serifLikeCount / totalChecked < 0.3;
  }

  function detectVerticalStems(commands, font) {
    const stems = [];
    const unitsPerEm = font.unitsPerEm || 1000;
    const minHeight = unitsPerEm * 0.05;
    const maxWidth = /italic/gi.test(font.names.fontSubfamily.en)
                         ? unitsPerEm * 0.03
                         : unitsPerEm * 0.01;

    for (let i = 1; i < commands.length; i++) {
      const c1 = commands[i - 1];
      const c2 = commands[i];
      if (c1.x !== undefined && c2.x !== undefined && c1.y !== undefined &&
          c2.y !== undefined) {
        const dx = Math.abs(c1.x - c2.x);
        const dy = Math.abs(c1.y - c2.y);
        if (dx < maxWidth && dy > minHeight) {
          stems.push({x : (c1.x + c2.x) / 2, y1 : c1.y, y2 : c2.y});
        }
      }
    }
    return stems;
  }

  function hasSerifProtrusions(commands, bounds, stems) {
    let count = 0;
    const glyphWidth = bounds.x2 - bounds.x1;
    if (glyphWidth === 0)
      return false;

    for (let stem of stems) {
      const yTop = Math.min(stem.y1, stem.y2);
      const yBottom = Math.max(stem.y1, stem.y2);

      const topPoints =
          commands.filter(c => c.y !== undefined && Math.abs(c.y - yTop) < 10);
      const bottomPoints = commands.filter(c => c.y !== undefined &&
                                                Math.abs(c.y - yBottom) < 10);

      const topWidth = maxX(topPoints) - minX(topPoints);
      const bottomWidth = maxX(bottomPoints) - minX(bottomPoints);

      const topRatio = topWidth / glyphWidth;
      const bottomRatio = bottomWidth / glyphWidth;

      // console.log(`Stem at x=${stem.x}: topRatio=${topRatio}, bottomRatio=${
      // bottomRatio}, topPoints=${topPoints.length}, bottomPoints=${
      // bottomPoints.length}`);
      const hasRatioMatch = (topRatio >= 0.15 && topRatio <= 0.35) ||
                            (bottomRatio >= 0.15 && bottomRatio <= 0.35);

      let hasHorizontalSegment = false;
      for (let i = 1; i < commands.length; i++) {
        const c1 = commands[i - 1];
        const c2 = commands[i];
        if (c1.x !== undefined && c2.x !== undefined && c1.y !== undefined &&
            c2.y !== undefined) {
          const dx = Math.abs(c1.x - c2.x);
          const dy = Math.abs(c1.y - c2.y);
          if (dy < 5 && dx > 10 && dx < glyphWidth * 0.2 &&
              (Math.abs(c1.y - yTop) < 10 || Math.abs(c1.y - yBottom) < 10)) {
            // console.log(`Horizontal segment detected: dx=${dx}, dy=${dy},
            // c1=${ JSON.stringify(c1)}, c2=${JSON.stringify(c2)}`);
            hasHorizontalSegment = true;
            break;
          }
        }
      }

      if (hasRatioMatch && hasHorizontalSegment) {
        // console.log(`Serif confirmed for stem at x=${stem.x}`);
        count++;
      }
    }

    return count > 0;
  }

  function maxX(points) { return Math.max(...points.map(p => p.x || 0)); }
  function minX(points) { return Math.min(...points.map(p => p.x || 0)); }

  function bodyAverage() {
    return Number(((font.h.ratio + font.o.ratio) / 2).toFixed(2));
  }

  function test(min, max, ratio) { return ratio >= min && ratio <= max; }

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
  splitAndFormat(getGlyphs('O').filter(c => c.type === 'L' || c.type === 'C'),
                 font.o);
  font.o.width = getSize(font.o.x);
  font.o.height = getSize(font.o.y);
  font.o.ratio = getRatio(font.o.width, font.o.height);

  font.test.sansSerif = isSansSerif(opentype);
  font.test.notitalic = not_italicTest();
  font.body.ratio = bodyAverage();

  function standardsTest(bodyMin, bodyMax, bodyRatio, strokeMin, strokeMax,
                         strokeRatio) { // california or federal
    if (font.test.sansSerif && font.test.notitalic) {
      if (test(bodyMin, bodyMax, bodyRatio)) {
        return test(strokeMin, strokeMax, strokeRatio);
      }
    }
    return false;
  }

  font.test.federal.tactile = standardsTest(
      font.federal.body.min, font.federal.body.max, font.body.ratio,
      font.federal.tactile.min, font.federal.tactile.max, font.stroke.ratio);
  font.test.federal.visual = standardsTest(
      font.federal.body.min, font.federal.body.max, font.body.ratio,
      font.federal.visual.min, font.federal.visual.max, font.stroke.ratio);
  font.test.california.tactile =
      standardsTest(font.california.body.min, font.california.body.max,
                    font.body.ratio, font.california.tactile.min,
                    font.california.tactile.max, font.stroke.ratio);
  font.test.california.visual =
      standardsTest(font.california.body.min, font.california.body.max,
                    font.body.ratio, font.california.visual.min,
                    font.california.visual.max, font.stroke.ratio);

  return font;
}

//  Get the file path from the command-line arguments
for (let i = 2; i < process.argv.length; i++) {
  const filePath = process.argv[i];
  checkfont(filePath);
}
