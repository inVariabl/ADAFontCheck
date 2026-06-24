import wasmUrl from './ada_analyzer.wasm?url';

let analyzerPromise;

export function loadAdaAnalyzer() {
  analyzerPromise ??= WebAssembly.instantiateStreaming(fetch(wasmUrl), {}).then(
    ({ instance }) => ({
      exports: instance.exports,
      memory: instance.exports.memory
    })
  );
  return analyzerPromise;
}

const RESULT_INTS = 11;
const RESULT_FLOATS = 11;
const RESULT_COORDS = 64;
const RESULT_NAME = 256;
const SZ_INT = 4;
const SZ_FLT = 4;

const OFF_NAME_LEN = 0;
const OFF_SUBFAMILY_LEN = 4;
const OFF_I_XC = 8;
const OFF_I_YC = 12;
const OFF_H_XC = 16;
const OFF_H_YC = 20;
const OFF_O_XC = 24;
const OFF_O_YC = 28;
const OFF_IS_SANS = 32;
const OFF_IS_ITALIC = 36;
const OFF_ERROR = 40;
const OFF_I_W = 44;
const OFF_I_H = 48;
const OFF_I_R = 52;
const OFF_H_W = 56;
const OFF_H_H = 60;
const OFF_H_R = 64;
const OFF_O_W = 68;
const OFF_O_H = 72;
const OFF_O_R = 76;
const OFF_BODY_R = 80;
const OFF_STROKE_R = 84;
const OFF_I_X = 88;
const OFF_I_Y = 344;
const OFF_H_X = 600;
const OFF_H_Y = 856;
const OFF_O_X = 1112;
const OFF_O_Y = 1368;
const OFF_NAME = 1624;
const OFF_SUBFAMILY = 1880;

export async function analyzeFont(buffer) {
  const { exports, memory } = await loadAdaAnalyzer();

  const fontPtr = exports.get_font_ptr();
  const resultPtr = exports.get_result_ptr();

  const data = new Uint8Array(buffer);
  if (data.length > 8 * 1024 * 1024) {
    return { error: 'Font too large (>8MB)' };
  }

  new Uint8Array(memory.buffer, fontPtr, data.length).set(data);
  const ret = exports.analyze_font(data.length);
  if (ret !== 0) {
    const errors = {
      [-1]: 'Failed to parse font',
      [-3]: 'Variable font (not supported)',
      [-4]: 'CFF2 font (not supported)'
    };
    return { error: errors[ret] || 'Failed to parse font' };
  }

  const view = new DataView(memory.buffer, resultPtr);
  const err = view.getInt32(OFF_ERROR, true);
  if (err) {
    return { error: 'Font analysis failed' };
  }

  const nameLen = view.getInt32(OFF_NAME_LEN, true);
  const subfamilyLen = view.getInt32(OFF_SUBFAMILY_LEN, true);
  const name = nameLen > 0 ? readString(memory.buffer, resultPtr + OFF_NAME, nameLen) : 'Unknown Font';
  const subfamily = subfamilyLen > 0 ? readString(memory.buffer, resultPtr + OFF_SUBFAMILY, subfamilyLen) : 'Regular';

  function readCoords(off, count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push(view.getFloat32(off + i * SZ_FLT, true));
    }
    return arr;
  }

  function makeGlyph(xOff, yOff, xc, yc, w, h, r) {
    return {
      x: readCoords(xOff, xc),
      y: readCoords(yOff, yc),
      width: w,
      height: h,
      ratio: r,
      commands: []
    };
  }

  const i = makeGlyph(OFF_I_X, OFF_I_Y, view.getInt32(OFF_I_XC, true), view.getInt32(OFF_I_YC, true), view.getFloat32(OFF_I_W, true), view.getFloat32(OFF_I_H, true), view.getFloat32(OFF_I_R, true));
  const h = makeGlyph(OFF_H_X, OFF_H_Y, view.getInt32(OFF_H_XC, true), view.getInt32(OFF_H_YC, true), view.getFloat32(OFF_H_W, true), view.getFloat32(OFF_H_H, true), view.getFloat32(OFF_H_R, true));
  const o = makeGlyph(OFF_O_X, OFF_O_Y, view.getInt32(OFF_O_XC, true), view.getInt32(OFF_O_YC, true), view.getFloat32(OFF_O_W, true), view.getFloat32(OFF_O_H, true), view.getFloat32(OFF_O_R, true));

  const sansSerif = view.getInt32(OFF_IS_SANS, true) !== 0;
  const notitalic = view.getInt32(OFF_IS_ITALIC, true) !== 0;
  const bodyRatio = view.getFloat32(OFF_BODY_R, true);
  const strokeRatio = view.getFloat32(OFF_STROKE_R, true);

  return {
    name,
    weight: subfamily,
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

function readString(buf, offset, len) {
  const bytes = new Uint8Array(buf, offset, len);
  return new TextDecoder().decode(bytes);
}
