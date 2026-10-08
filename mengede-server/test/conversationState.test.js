import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateConversationState } from '../services/conversationState.js';

test('conversation state estimator identifies overwhelm and recommends fewer choices', () => {
  const result = estimateConversationState(
    "There are too many options and I don't know where to start."
  );

  assert.equal(result.state, 'overwhelm');
  assert.equal(result.strategy, 'reduce_choices');
  assert.ok(result.confidence > 0.5);
});

test('conversation state estimator stays neutral without distress evidence', () => {
  const result = estimateConversationState(
    'Which universities offer mechanical engineering?'
  );

  assert.equal(result.state, 'calm');
  assert.equal(result.strategy, 'normal_guidance');
  assert.deepEqual(result.evidence, []);
});
