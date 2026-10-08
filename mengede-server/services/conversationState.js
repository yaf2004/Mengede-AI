const PATTERNS = {
  confusion: [
    /i\s+(?:don't|do not)\s+(?:understand|get)/i,
    /i'?m\s+confused/i,
    /what\s+does\s+that\s+mean/i,
    /which\s+one\s+should\s+i\s+choose/i
  ],
  overwhelm: [
    /too\s+many/i,
    /overwhelmed/i,
    /i\s+don't\s+know\s+where\s+to\s+start/i,
    /i\s+can't\s+decide/i,
    /this\s+is\s+too\s+much/i
  ],
  frustration: [
    /this\s+isn'?t\s+working/i,
    /doesn'?t\s+work/i,
    /frustrat/i,
    /annoy/i,
    /stuck/i,
    /why\s+isn'?t/i
  ],
  urgency: [
    /urgent/i,
    /asap/i,
    /deadline/i,
    /today/i,
    /right\s+now/i,
    /immediately/i
  ],
  low_confidence: [
    /i'?m\s+not\s+(?:good|smart|sure)/i,
    /i\s+can'?t\s+do\s+(?:this|it)/i,
    /i'?m\s+not\s+capable/i,
    /i\s+don'?t\s+think\s+i\s+can/i
  ]
};

const RESPONSE_STRATEGY = {
  calm: 'normal_guidance',
  curious: 'explore_options',
  confused: 'simplify_and_clarify',
  overwhelmed: 'reduce_choices',
  frustrated: 'acknowledge_and_troubleshoot',
  low_confidence: 'encourage_and_make_next_step_small',
  urgent: 'prioritize_immediate_next_step'
};

export function estimateConversationState(text = '') {
  const input = String(text).trim();
  const scores = Object.fromEntries(
    Object.keys(PATTERNS).map(key => [key, 0])
  );

  for (const [state, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) scores[state] += 1;
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topState, topScore] = ranked[0] || ['calm', 0];

  if (topScore === 0) {
    return {
      state: 'calm',
      confidence: 0.45,
      scores,
      strategy: RESPONSE_STRATEGY.calm,
      evidence: []
    };
  }

  const matched = ranked
    .filter(([, score]) => score > 0)
    .slice(0, 3)
    .map(([state]) => state);

  const state =
    topState === 'urgency'
      ? 'urgent'
      : topState === 'low_confidence'
        ? 'low_confidence'
        : topState;

  return {
    state,
    confidence: Math.min(0.95, 0.55 + topScore * 0.12),
    scores,
    strategy: RESPONSE_STRATEGY[state] || RESPONSE_STRATEGY.calm,
    evidence: matched
  };
}
