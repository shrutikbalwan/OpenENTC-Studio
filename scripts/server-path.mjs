import { fileURLToPath } from 'node:url';

export function rootFromModuleUrl(moduleUrl) {
  return fileURLToPath(new URL('../', moduleUrl));
}
