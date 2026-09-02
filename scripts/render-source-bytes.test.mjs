import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { normalizeRenderSourceBytes } from './render-source-bytes.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('normalizes CRLF and bare CR in every text render-source type', () => {
  for (const extension of ['.css', '.gltf', '.json', '.svg', '.ts', '.tsx']) {
    const windows = Buffer.from('first\r\nsecond\rthird\n', 'utf8');
    const unix = Buffer.from('first\nsecond\nthird\n', 'utf8');
    assert.deepEqual(normalizeRenderSourceBytes(`fixture${extension}`, windows), unix);
    assert.equal(
      sha256(normalizeRenderSourceBytes(`fixture${extension}`, windows)),
      sha256(normalizeRenderSourceBytes(`fixture${extension}`, unix)),
    );
  }
});
test('hashes binary render sources byte-for-byte without newline conversion', () => {
  for (const extension of ['.bin', '.glb', '.jpeg', '.jpg', '.png', '.webp']) {
    const binary = Buffer.from([0, 13, 10, 13, 255, 128, 10]);
    assert.deepEqual(normalizeRenderSourceBytes(`fixture${extension}`, binary), binary);
    assert.notEqual(
      sha256(normalizeRenderSourceBytes(`fixture${extension}`, binary)),
      sha256(Buffer.from([0, 10, 10, 255, 128, 10])),
    );
  }
});

test('rejects unclassified extensions instead of silently treating them as text', () => {
  assert.throws(
    () => normalizeRenderSourceBytes('fixture.unknown', Buffer.from('value\r\n')),
    /Unsupported render-source extension/u,
  );
});
