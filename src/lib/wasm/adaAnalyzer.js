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

const SZ_INT = 4;
const SZ_FLOAT = 4;
const MAX_COORDS = 64;
const MAX_VERTICES = 64;
const VERTEX_STRIDE = 7 * SZ_INT;

const OFF_NAME_LEN = 0;
const OFF_SUBFAMILY_LEN = 4;
const OFF_I_XC = 8;
const OFF_I_YC = 12;
const OFF_H_XC = 16;
const OFF_H_YC = 20;
const OFF_O_XC = 24;
const OFF_O_YC = 28;
const OFF_I_VC = 32;
const OFF_H_VC = 36;
const OFF_O_VC = 40;
const OFF_IS_SANS = 44;
const OFF_IS_ITALIC = 48;
const OFF_ERROR = 52;
const OFF_I_W = 56;
const OFF_I_H = 60;
const OFF_I_R = 64;
const OFF_H_W = 68;
const OFF_H_H = 72;
const OFF_H_R = 76;
const OFF_O_W = 80;
const OFF_O_H = 84;
const OFF_O_R = 88;
const OFF_BODY_R = 92;
const OFF_STROKE_R = 96;
const OFF_I_X = 100;
const OFF_I_Y = OFF_I_X + MAX_COORDS * SZ_FLOAT;
const OFF_H_X = OFF_I_Y + MAX_COORDS * SZ_FLOAT;
const OFF_H_Y = OFF_H_X + MAX_COORDS * SZ_FLOAT;
const OFF_O_X = OFF_H_Y + MAX_COORDS * SZ_FLOAT;
const OFF_O_Y = OFF_O_X + MAX_COORDS * SZ_FLOAT;
const OFF_I_VERTS = OFF_O_Y + MAX_COORDS * SZ_FLOAT;
const OFF_H_VERTS = OFF_I_VERTS + MAX_VERTICES * VERTEX_STRIDE;
const OFF_O_VERTS = OFF_H_VERTS + MAX_VERTICES * VERTEX_STRIDE;
const OFF_NAME = OFF_O_VERTS + MAX_VERTICES * VERTEX_STRIDE;
const OFF_SUBFAMILY = OFF_NAME + 256;

const VERTEX_TYPES = {
  1: 'M',
  2: 'L',
  3: 'Q',
  4: 'C'
};

function readFloatArray(view, offset, count) {
  const values = [];
  const limit = Math.min(count, MAX_COORDS);
  for (let i = 0; i < limit; i += 1) {
    values.push(view.getFloat32(offset + i * SZ_FLOAT, true));
  }
  return values;
}

function readVertices(view, offset, count) {
  const commands = [];
  const limit = Math.min(count, MAX_VERTICES);
  for (let i = 0; i < limit; i += 1) {
    const base = offset + i * VERTEX_STRIDE;
    const type = VERTEX_TYPES[view.getInt32(base, true)] ?? 'M';
    const command = {
      type,
      x: view.getInt32(base + SZ_INT, true),
      y: view.getInt32(base + 2 * SZ_INT, true)
    };

    if (type === 'Q' || type === 'C') {
      command.cx = view.getInt32(base + 3 * SZ_INT, true);
      command.cy = view.getInt32(base + 4 * SZ_INT, true);
      command.x1 = command.cx;
      command.y1 = command.cy;
    }
    if (type === 'C') {
      command.cx1 = view.getInt32(base + 5 * SZ_INT, true);
      command.cy1 = view.getInt32(base + 6 * SZ_INT, true);
      command.x2 = command.cx1;
      command.y2 = command.cy1;
    }

    commands.push(command);
  }
  return commands;
}

function readString(buf, offset, len) {
  if (len <= 0) {
    return '';
  }
  const bytes = new Uint8Array(buf, offset, len);
  return new TextDecoder().decode(bytes).replace(/\0+$/, '');
}

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

  const iCount = view.getInt32(OFF_I_XC, true);
  const hCount = view.getInt32(OFF_H_XC, true);
  const oCount = view.getInt32(OFF_O_XC, true);
  const iVertexCount = view.getInt32(OFF_I_VC, true);
  const hVertexCount = view.getInt32(OFF_H_VC, true);
  const oVertexCount = view.getInt32(OFF_O_VC, true);

  return {
    name: nameLen > 0 ? readString(memory.buffer, resultPtr + OFF_NAME, nameLen) : 'Unknown Font',
    weight: subfamilyLen > 0 ? readString(memory.buffer, resultPtr + OFF_SUBFAMILY, subfamilyLen) : 'Regular',
    i: {
      x: readFloatArray(view, OFF_I_X, iCount),
      y: readFloatArray(view, OFF_I_Y, iCount),
      width: view.getFloat32(OFF_I_W, true),
      height: view.getFloat32(OFF_I_H, true),
      ratio: view.getFloat32(OFF_I_R, true),
      commands: readVertices(view, OFF_I_VERTS, iVertexCount)
    },
    h: {
      x: readFloatArray(view, OFF_H_X, hCount),
      y: readFloatArray(view, OFF_H_Y, hCount),
      width: view.getFloat32(OFF_H_W, true),
      height: view.getFloat32(OFF_H_H, true),
      ratio: view.getFloat32(OFF_H_R, true),
      commands: readVertices(view, OFF_H_VERTS, hVertexCount)
    },
    o: {
      x: readFloatArray(view, OFF_O_X, oCount),
      y: readFloatArray(view, OFF_O_Y, oCount),
      width: view.getFloat32(OFF_O_W, true),
      height: view.getFloat32(OFF_O_H, true),
      ratio: view.getFloat32(OFF_O_R, true),
      commands: readVertices(view, OFF_O_VERTS, oVertexCount)
    },
    stroke: { ratio: view.getFloat32(OFF_STROKE_R, true) },
    body: { ratio: view.getFloat32(OFF_BODY_R, true) },
    test: {
      notitalic: view.getInt32(OFF_IS_ITALIC, true) !== 0,
      sansSerif: view.getInt32(OFF_IS_SANS, true) !== 0
    }
  };
}
