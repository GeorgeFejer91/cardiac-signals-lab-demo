import path from 'node:path';

const TEXT_RENDER_SOURCE_EXTENSIONS = new Set([
  '.css', '.gltf', '.json', '.svg', '.ts', '.tsx',
]);

const BINARY_RENDER_SOURCE_EXTENSIONS = new Set([
  '.bin', '.glb', '.jpeg', '.jpg', '.png', '.webp',
]);

export function normalizeRenderSourceBytes(filename, input) {
  const contents = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const extension = path.extname(filename).toLowerCase();
  if (BINARY_RENDER_SOURCE_EXTENSIONS.has(extension)) return contents;
  if (!TEXT_RENDER_SOURCE_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported render-source extension: ${extension || '(none)'}.`);
  }
  return Buffer.from(contents.toString('utf8').replace(/\r\n?/gu, '\n'), 'utf8');
}
