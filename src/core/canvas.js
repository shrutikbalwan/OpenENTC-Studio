export const MIN_CANVAS_SCALE = 0.5;
export const MAX_CANVAS_SCALE = 2.5;
export const DEFAULT_GRID_SIZE = 20;

export function clampCanvasScale(scale) {
  return Math.min(MAX_CANVAS_SCALE, Math.max(MIN_CANVAS_SCALE, Number(scale) || 1));
}

export function zoomCanvasView(view, factor, anchor = { x: 0, y: 0 }) {
  const oldScale = clampCanvasScale(view.scale);
  const scale = clampCanvasScale(oldScale * factor);
  const ratio = scale / oldScale;
  return { scale, x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio };
}

export function screenToCanvas(point, view) {
  const scale = clampCanvasScale(view.scale);
  return { x: (point.x - view.x) / scale, y: (point.y - view.y) / scale };
}

export function fitCanvasView(components, viewport, padding = 48) {
  if (!components.length) return { x: 0, y: 0, scale: 1 };
  const left = Math.min(...components.map((part) => part.x)) - padding;
  const top = Math.min(...components.map((part) => part.y)) - padding;
  const right = Math.max(...components.map((part) => part.x)) + padding;
  const bottom = Math.max(...components.map((part) => part.y)) + padding;
  const scale = clampCanvasScale(Math.min(viewport.width / Math.max(1, right - left), viewport.height / Math.max(1, bottom - top)));
  return { x: (viewport.width - (right - left) * scale) / 2 - left * scale, y: (viewport.height - (bottom - top) * scale) / 2 - top * scale, scale };
}

export function snapCanvasPoint(point, gridSize = DEFAULT_GRID_SIZE) {
  const grid = Number(gridSize);
  if (!Number.isFinite(grid) || grid <= 0) return { x: point.x, y: point.y };
  return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
}
