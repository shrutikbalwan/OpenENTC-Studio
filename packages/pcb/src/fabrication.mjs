// Fabrication outputs: Gerber RS-274X (with X2 file attributes), Excellon drill, BOM,
// pick-and-place, a stroke font for silkscreen references, a store-only ZIP writer and
// the IPC-2221 trace-width estimate.

import { formatEngineeringValue } from '../../schematic/src/units.mjs';

// ---------------------------------------------------------------------------
// Stroke font: glyphs on a 4 × 6 grid (y down), drawn as polylines.

const GLYPHS = {
  0: [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0], [0, 6, 4, 0]], 1: [[1, 1, 2, 0, 2, 6], [1, 6, 3, 6]], 2: [[0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 0, 6, 4, 6]],
  3: [[0, 0, 4, 0, 2, 2.5, 3, 2.5, 4, 3.5, 4, 5, 3, 6, 1, 6, 0, 5]], 4: [[3, 6, 3, 0, 0, 4, 4, 4]], 5: [[4, 0, 0, 0, 0, 2.5, 3, 2.5, 4, 3.5, 4, 5, 3, 6, 0, 6]],
  6: [[3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3.5, 3, 2.5, 0, 2.5]], 7: [[0, 0, 4, 0, 1, 6]],
  8: [[1, 0, 3, 0, 4, 1, 4, 2, 3, 3, 1, 3, 0, 4, 0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 3, 3], [1, 3, 0, 2, 0, 1, 1, 0]], 9: [[4, 3.5, 1, 3.5, 0, 2.5, 0, 1, 1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6]],
  A: [[0, 6, 0, 2, 2, 0, 4, 2, 4, 6], [0, 3.5, 4, 3.5]], B: [[0, 0, 0, 6, 3, 6, 4, 5, 4, 4, 3, 3, 0, 3], [0, 0, 3, 0, 4, 1, 4, 2, 3, 3]], C: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5]],
  D: [[0, 0, 0, 6, 2.5, 6, 4, 4.5, 4, 1.5, 2.5, 0, 0, 0]], E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]], F: [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]],
  G: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3.5, 2, 3.5]], H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]], I: [[1, 0, 3, 0], [2, 0, 2, 6], [1, 6, 3, 6]],
  J: [[4, 0, 4, 5, 3, 6, 1, 6, 0, 5]], K: [[0, 0, 0, 6], [4, 0, 0, 3.5], [1.2, 2.8, 4, 6]], L: [[0, 0, 0, 6, 4, 6]], M: [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]], O: [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0]], P: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3]],
  Q: [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0], [2.5, 4.5, 4, 6]], R: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3], [2, 3, 4, 6]],
  S: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 2, 1, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]], T: [[0, 0, 4, 0], [2, 0, 2, 6]], U: [[0, 0, 0, 5, 1, 6, 3, 6, 4, 5, 4, 0]],
  V: [[0, 0, 2, 6, 4, 0]], W: [[0, 0, 1, 6, 2, 3, 3, 6, 4, 0]], X: [[0, 0, 4, 6], [4, 0, 0, 6]], Y: [[0, 0, 2, 3, 4, 0], [2, 3, 2, 6]], Z: [[0, 0, 4, 0, 0, 6, 4, 6]],
  '-': [[1, 3, 3, 3]], '+': [[1, 3, 3, 3], [2, 2, 2, 4]], _: [[0, 6, 4, 6]], '.': [[2, 5.6, 2, 6]],
};

/** Line segments for `text` with its top-left at (x, y) and cap height `height` mm. */
export function strokeText(text, x, y, height = 1) {
  const unit = height / 6;
  const segments = [];
  [...String(text).toUpperCase()].forEach((character, index) => {
    for (const line of GLYPHS[character] || []) {
      for (let k = 2; k < line.length; k += 2) segments.push([x + (index * 5.5 + line[k - 2]) * unit, y + line[k - 1] * unit, x + (index * 5.5 + line[k]) * unit, y + line[k + 1] * unit]);
    }
  });
  return segments;
}
export const strokeTextWidth = (text, height = 1) => (String(text).length * 5.5 - 1.5) * height / 6;

/** Reference-designator text placed just above each part (all parts are on the top side). */
export function silkscreen(board, height = 1) {
  const lines = board.parts.flatMap((part) => part.silk);
  for (const part of board.parts) {
    const width = strokeTextWidth(part.reference, height);
    const cx = (part.bounds.x1 + part.bounds.x2) / 2;
    lines.push(...strokeText(part.reference, cx - width / 2, part.bounds.y1 - height - 0.4, height));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Gerber.

class GerberWriter {
  constructor(board, fileFunction, polarity = 'Positive') {
    this.offsetX = board.outline.x1; this.top = board.outline.y2;
    this.header = ['G04 OpenENTC Studio PCB export*', '%TF.GenerationSoftware,OpenENTC,Studio,0.1*%', `%TF.FileFunction,${fileFunction}*%`, `%TF.FilePolarity,${polarity}*%`, '%FSLAX46Y46*%', '%MOMM*%', '%LPD*%'];
    this.apertures = new Map(); this.body = []; this.current = null;
  }
  coord(x, y) { return `X${Math.round((x - this.offsetX) * 1e6)}Y${Math.round((this.top - y) * 1e6)}`; }
  aperture(definition) {
    if (!this.apertures.has(definition)) this.apertures.set(definition, 10 + this.apertures.size);
    return this.apertures.get(definition);
  }
  select(code) { if (this.current !== code) { this.body.push(`D${code}*`); this.current = code; } }
  flashPad(shape, expansion = 0) {
    const definition = shape.kind === 'circle' ? `C,${mm(2 * shape.r + 2 * expansion)}` : `R,${mm(shape.w + 2 * expansion)}X${mm(shape.h + 2 * expansion)}`;
    this.select(this.aperture(definition));
    this.body.push(`${this.coord(shape.x, shape.y)}D03*`);
  }
  line(x1, y1, x2, y2, width) {
    this.select(this.aperture(`C,${mm(width)}`));
    this.body.push(`${this.coord(x1, y1)}D02*`, `${this.coord(x2, y2)}D01*`);
  }
  toString() {
    const apertureLines = [...this.apertures].map(([definition, code]) => `%ADD${code}${definition}*%`);
    return [...this.header, ...apertureLines, 'G01*', ...this.body, 'M02*', ''].join('\n');
  }
}
const mm = (value) => value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');

function copperLayer(board, tracks, vias, side) {
  const writer = new GerberWriter(board, side === 'top' ? 'Copper,L1,Top' : 'Copper,L2,Bot');
  for (const pad of board.pads) if (pad.layers.includes(side)) writer.flashPad(pad.shape);
  for (const via of vias) writer.flashPad({ kind: 'circle', x: via.x, y: via.y, r: via.diameter / 2 });
  for (const track of tracks) if (track.layer === side) writer.line(track.x1, track.y1, track.x2, track.y2, track.width);
  return writer.toString();
}

function maskLayer(board, side) {
  const writer = new GerberWriter(board, side === 'top' ? 'Soldermask,Top' : 'Soldermask,Bot', 'Negative');
  for (const pad of board.pads) if (pad.layers.includes(side)) writer.flashPad(pad.shape, board.rules.maskExpansion);
  return writer.toString();
}

function silkLayer(board) {
  const writer = new GerberWriter(board, 'Legend,Top');
  for (const [x1, y1, x2, y2] of silkscreen(board)) writer.line(x1, y1, x2, y2, 0.15);
  return writer.toString();
}

function outlineLayer(board) {
  const writer = new GerberWriter(board, 'Profile,NP');
  const { x1, y1, x2, y2 } = board.outline;
  writer.select(writer.aperture('C,0.1'));
  writer.body.push(`${writer.coord(x1, y1)}D02*`, `${writer.coord(x2, y1)}D01*`, `${writer.coord(x2, y2)}D01*`, `${writer.coord(x1, y2)}D01*`, `${writer.coord(x1, y1)}D01*`);
  return writer.toString();
}

/** Excellon drill file (metric, decimal coordinates) for plated pad holes and vias. */
export function excellonDrill(board, vias = []) {
  const holes = [...board.pads.filter((pad) => pad.drill).map((pad) => ({ x: pad.x, y: pad.y, d: pad.drill })), ...vias.map((via) => ({ x: via.x, y: via.y, d: via.drill }))];
  const sizes = [...new Set(holes.map((hole) => hole.d.toFixed(3)))].sort((a, b) => Number(a) - Number(b));
  const lines = ['M48', '; DRILL file OpenENTC Studio, plated through holes', '; FORMAT={-:-/ absolute / metric / decimal}', 'FMAT,2', 'METRIC'];
  sizes.forEach((size, index) => lines.push(`T${index + 1}C${size}`));
  lines.push('%', 'G05');
  sizes.forEach((size, index) => {
    lines.push(`T${index + 1}`);
    for (const hole of holes.filter((entry) => entry.d.toFixed(3) === size)) lines.push(`X${(hole.x - board.outline.x1).toFixed(3)}Y${(board.outline.y2 - hole.y).toFixed(3)}`);
  });
  lines.push('M30', '');
  return { text: lines.join('\n'), holes: holes.length, tools: sizes.length };
}

const csvCell = (value) => { const text = String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; };
const formatValue = (part) => (Number.isFinite(part.value) && part.unit && !['state', 'β', 'Vf', 'Vth', 'Vsat'].includes(part.unit) ? formatEngineeringValue(part.value, part.unit).replace(' ', '') : '');

/** Bill of materials grouped by value and footprint. */
export function billOfMaterials(board) {
  const groups = new Map();
  for (const part of board.parts) {
    const key = `${part.type}|${formatValue(part)}|${part.footprint.name}`;
    if (!groups.has(key)) groups.set(key, { type: part.type, value: formatValue(part), footprint: part.footprint.name, references: [] });
    groups.get(key).references.push(part.reference);
  }
  const rows = [...groups.values()].sort((a, b) => a.references[0].localeCompare(b.references[0], undefined, { numeric: true }));
  const text = ['Designator,Quantity,Type,Value,Footprint', ...rows.map((row) => [row.references.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(' '), row.references.length, row.type, row.value, row.footprint].map(csvCell).join(','))].join('\n') + '\n';
  return { rows, text };
}

/** Pick-and-place / component placement list (mm, origin at the board's bottom-left corner). */
export function placementFile(board) {
  const lines = ['Designator,Mid X,Mid Y,Layer,Rotation,Footprint'];
  for (const part of board.parts) lines.push([part.reference, `${(part.placement.x - board.outline.x1).toFixed(3)}mm`, `${(board.outline.y2 - part.placement.y).toFixed(3)}mm`, 'Top', part.placement.rotation, part.footprint.name].map(csvCell).join(','));
  return lines.join('\n') + '\n';
}

/** Every fabrication file, named with the usual Protel-style extensions. */
export function fabricationFiles(board, { tracks = [], vias = [], name = 'board' } = {}) {
  const base = String(name).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40) || 'board';
  return [
    { path: `${base}-F_Cu.gtl`, text: copperLayer(board, tracks, vias, 'top') },
    { path: `${base}-B_Cu.gbl`, text: copperLayer(board, tracks, vias, 'bottom') },
    { path: `${base}-F_Mask.gts`, text: maskLayer(board, 'top') },
    { path: `${base}-B_Mask.gbs`, text: maskLayer(board, 'bottom') },
    { path: `${base}-F_Silkscreen.gto`, text: silkLayer(board) },
    { path: `${base}-Edge_Cuts.gm1`, text: outlineLayer(board) },
    { path: `${base}-PTH.drl`, text: excellonDrill(board, vias).text },
    { path: `${base}-BOM.csv`, text: billOfMaterials(board).text },
    { path: `${base}-CPL.csv`, text: placementFile(board) },
  ];
}

// ---------------------------------------------------------------------------
// ZIP (store method, no compression).

const CRC_TABLE = (() => { const table = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } return table; })();
export function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

/** Build a ZIP archive (Uint8Array) from { path, text } entries. */
export function createZip(files, date = new Date(Date.UTC(2026, 0, 1))) {
  const encoder = new TextEncoder();
  const time = ((date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1)) & 0xffff;
  const day = (((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()) & 0xffff;
  const chunks = [], central = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.path), data = typeof file.text === 'string' ? encoder.encode(file.text) : file.bytes;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, day, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]].forEach(([at, value, size]) => (size === 4 ? local.setUint32(at, value, true) : local.setUint16(at, value, true)));
    chunks.push(new Uint8Array(local.buffer), name, data);
    const header = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, day, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]].forEach(([at, value, size]) => (size === 4 ? header.setUint32(at, value, true) : header.setUint16(at, value, true)));
    central.push(new Uint8Array(header.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, centralSize, 4], [16, offset, 4], [20, 0, 2]].forEach(([at, value, size]) => (size === 4 ? end.setUint32(at, value, true) : end.setUint16(at, value, true)));
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const output = new Uint8Array(all.reduce((sum, chunk) => sum + chunk.length, 0));
  let position = 0;
  for (const chunk of all) { output.set(chunk, position); position += chunk.length; }
  return output;
}

// ---------------------------------------------------------------------------
// IPC-2221 trace width.

/** Width (mm) for a current with a temperature rise, copper weight (oz) and layer position. */
export function traceWidthForCurrent({ current = 1, temperatureRise = 10, copperOz = 1, external = true } = {}) {
  const i = Number(current), rise = Number(temperatureRise), oz = Number(copperOz);
  if (!(i > 0 && i <= 100) || !(rise > 0 && rise <= 100) || !(oz > 0 && oz <= 10)) throw new RangeError('Use 0–100 A, 0–100 °C rise and 0–10 oz copper.');
  const k = external ? 0.048 : 0.024;
  const areaMil2 = (i / (k * rise ** 0.44)) ** (1 / 0.725);
  const thicknessMil = oz * 1.378;
  return { widthMm: areaMil2 / thicknessMil * 0.0254, widthMil: areaMil2 / thicknessMil, areaMil2 };
}
