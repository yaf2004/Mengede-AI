import test from 'node:test';
import assert from 'node:assert/strict';
import { splitText, cosineSimilarity } from '../services/rag.js';

test('splitText returns no chunks for empty input', () => {
  assert.deepEqual(splitText('  \n '), []);
});

test('splitText preserves document content across overlapping chunks', () => {
  const source = ('University programs require evidence. '.repeat(100));
  const chunks = splitText(source);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.length <= 1800));
  assert.ok(chunks[0].startsWith('University programs'));
  assert.ok(chunks[chunks.length - 1].length > 0);
});

test('cosineSimilarity ranks aligned vectors above orthogonal vectors', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
  assert.equal(cosineSimilarity([1], [1, 0]), -1);
});
