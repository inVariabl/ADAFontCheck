import { parse } from 'opentype.js';
import { deriveFontMetadataFromFilename } from './fontName.js';

function getNameEntry(nameTable, fallback) {
  if (typeof nameTable === 'string' && nameTable.trim()) {
    return nameTable;
  }
  if (!nameTable || typeof nameTable !== 'object') {
    return fallback;
  }
  if (typeof nameTable.en === 'string' && nameTable.en.trim()) {
    return nameTable.en;
  }

  const firstAvailable = Object.values(nameTable).find(
    (value) => typeof value === 'string' && value.trim()
  );
  return firstAvailable || fallback;
}

function getFirstNameEntry(font, keys, fallback) {
  for (const key of keys) {
    const value = getNameEntry(font.names?.[key], '');
    if (value) {
      return value;
    }
  }
  return fallback;
}

function splitArray(letterObject, xArray, yArray) {
  for (const point of letterObject) {
    xArray.push(point.x);
    yArray.push(point.y);
  }
}

function formatArray(array) {
  return array
    .filter((value) => value !== undefined)
    .sort((a, b) => a - b)
    .filter((item, pos, self) => self.indexOf(item) === pos);
}

function splitAndFormat(coordinates, letter) {
  splitArray(coordinates, letter.x, letter.y);
  letter.x = formatArray(letter.x);
  letter.y = formatArray(letter.y);
}

function removeBaselineAndTopSerifs(letter) {
  if (letter.x.length === 4 && letter.y.length === 4) {
    letter.x.pop();
    letter.x.splice(0, 1);
    letter.y.splice(1, 1);
    letter.y.splice(1, 1);
  }
}

function getSize(arr) {
  if (!arr.length) {
    return 0;
  }
  return arr[arr.length - 1] - arr[0];
}

function ratioPercent(width, height) {
  if (height === 0) {
    return 0;
  }
  return Number(((width / height) * 100).toFixed(2));
}

function averagePercent(first, second) {
  return Number((((first + second) / 2) || 0).toFixed(2));
}

function notItalicTest(subfamily) {
  return !/italic/i.test(subfamily);
}

function detectVerticalStems(commands, font) {
  const stems = [];
  const unitsPerEm = font.unitsPerEm || 1000;
  const minHeight = unitsPerEm * 0.05;
  const maxWidth = /italic/i.test(getNameEntry(font.names.fontSubfamily, ''))
    ? unitsPerEm * 0.03
    : unitsPerEm * 0.01;

  for (let i = 1; i < commands.length; i += 1) {
    const c1 = commands[i - 1];
    const c2 = commands[i];
    if (c1.x !== undefined && c2.x !== undefined && c1.y !== undefined && c2.y !== undefined) {
      const dx = Math.abs(c1.x - c2.x);
      const dy = Math.abs(c1.y - c2.y);
      if (dx < maxWidth && dy > minHeight) {
        stems.push({ x: (c1.x + c2.x) / 2, y1: c1.y, y2: c2.y });
      }
    }
  }
  return stems;
}

function maxX(points) {
  return Math.max(...points.map((point) => point.x || 0));
}

function minX(points) {
  return Math.min(...points.map((point) => point.x || 0));
}

function hasSerifProtrusions(commands, bounds, stems) {
  const glyphWidth = bounds.x2 - bounds.x1;
  if (glyphWidth === 0) {
    return false;
  }

  for (const stem of stems) {
    const yTop = Math.min(stem.y1, stem.y2);
    const yBottom = Math.max(stem.y1, stem.y2);
    const topPoints = commands.filter((c) => c.y !== undefined && Math.abs(c.y - yTop) < 10);
    const bottomPoints = commands.filter((c) => c.y !== undefined && Math.abs(c.y - yBottom) < 10);
    const topRatio = (maxX(topPoints) - minX(topPoints)) / glyphWidth;
    const bottomRatio = (maxX(bottomPoints) - minX(bottomPoints)) / glyphWidth;
    const hasRatioMatch =
      (topRatio >= 0.15 && topRatio <= 0.35) || (bottomRatio >= 0.15 && bottomRatio <= 0.35);

    let hasHorizontalSegment = false;
    for (let i = 1; i < commands.length; i += 1) {
      const c1 = commands[i - 1];
      const c2 = commands[i];
      if (c1.x !== undefined && c2.x !== undefined && c1.y !== undefined && c2.y !== undefined) {
        const dx = Math.abs(c1.x - c2.x);
        const dy = Math.abs(c1.y - c2.y);
        if (
          dy < 5 &&
          dx > 10 &&
          dx < glyphWidth * 0.2 &&
          (Math.abs(c1.y - yTop) < 10 || Math.abs(c1.y - yBottom) < 10)
        ) {
          hasHorizontalSegment = true;
          break;
        }
      }
    }

    if (hasRatioMatch && hasHorizontalSegment) {
      return true;
    }
  }

  return false;
}

function isSansSerif(font) {
  const serifIndicators = [/serif/i, /times/i, /georgia/i, /garamond/i, /baskerville/i];
  const sansSerifIndicators = [/sans/i, /helvetica/i, /arial/i, /verdana/i, /futura/i];
  const fontName = getNameEntry(font.names.fullName, '').toLowerCase();

  if (serifIndicators.some((regex) => regex.test(fontName))) {
    return false;
  }
  if (sansSerifIndicators.some((regex) => regex.test(fontName))) {
    return true;
  }

  let serifLikeCount = 0;
  let totalChecked = 0;
  const testGlyphs = ['A', 'E', 'H', 'B', 'G'];

  for (const char of testGlyphs) {
    let glyph;
    try {
      glyph = font.charToGlyph(char);
    } catch {
      continue;
    }

    if (!glyph.path || !glyph.path.commands.length) {
      continue;
    }

    const bounds = glyph.getBoundingBox();
    const verticalEdges = detectVerticalStems(glyph.path.commands, font);
    if (hasSerifProtrusions(glyph.path.commands, bounds, verticalEdges)) {
      serifLikeCount += 1;
    }
    totalChecked += 1;
  }

  if (totalChecked === 0) {
    return false;
  }

  return serifLikeCount / totalChecked < 0.3;
}

function serializeCommand(command) {
  const serialized = { type: command.type };
  for (const key of ['x', 'y', 'x1', 'y1', 'x2', 'y2']) {
    if (command[key] !== undefined) {
      serialized[key] = command[key];
    }
  }
  return serialized;
}

function glyphPath(font, letter) {
  return font.getPath(letter, 0, 150, 72).commands.map(serializeCommand);
}

function analyzeGlyph(font, letter, options = {}) {
  const sourceCommands = glyphPath(font, letter);
  const metricCommands = options.filter
    ? sourceCommands.filter(options.filter)
    : sourceCommands;
  const metric = { x: [], y: [], width: 0, height: 0, ratio: 0, commands: sourceCommands };
  splitAndFormat(metricCommands, metric);
  if (options.trimSerifs) {
    removeBaselineAndTopSerifs(metric);
  }
  metric.width = getSize(metric.x);
  metric.height = getSize(metric.y);
  metric.ratio = ratioPercent(metric.width, metric.height);
  return metric;
}

export function analyzeFontWithOpenType(buffer, fileName = '') {
  const font = parse(buffer);
  const family = getFirstNameEntry(
    font,
    ['preferredFamily', 'fontFamily', 'fullName', 'postScriptName'],
    'Unknown Font'
  );
  const subfamily = getFirstNameEntry(font, ['preferredSubfamily', 'fontSubfamily'], 'Regular');
  const fullName = family === 'Unknown Font' ? family : `${family} ${subfamily}`.trim();
  const fallbackMeta = deriveFontMetadataFromFilename(fileName);
  const name = fullName === 'Unknown Font' ? fallbackMeta.name : fullName;
  const weight = fullName === 'Unknown Font' ? fallbackMeta.weight : subfamily;

  const i = analyzeGlyph(font, 'I', { trimSerifs: true });
  const h = analyzeGlyph(font, 'H');
  const o = analyzeGlyph(font, 'O', {
    filter: (command) => command.type === 'L' || command.type === 'C'
  });
  const sansSerif = isSansSerif(font);
  const notitalic = notItalicTest(subfamily);
  const bodyRatio = averagePercent(h.ratio, o.ratio);
  const strokeRatio = i.ratio;

  return {
    name,
    weight,
    i,
    h,
    o,
    stroke: { ratio: strokeRatio },
    body: { ratio: bodyRatio },
    test: {
      notitalic,
      sansSerif
    }
  };
}
