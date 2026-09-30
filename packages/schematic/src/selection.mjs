export function componentsInRect(components = [], rect) {
  if (!Array.isArray(components) || !rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return [];
  const left = Math.min(rect.x, rect.x + rect.width);
  const right = Math.max(rect.x, rect.x + rect.width);
  const top = Math.min(rect.y, rect.y + rect.height);
  const bottom = Math.max(rect.y, rect.y + rect.height);
  return components.filter((component) => Number.isFinite(component.x) && Number.isFinite(component.y) && component.x >= left && component.x <= right && component.y >= top && component.y <= bottom).map((component) => component.id);
}
