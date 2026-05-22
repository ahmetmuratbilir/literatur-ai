import test from 'node:test';
import assert from 'node:assert/strict';
import { runRevisionCoach } from '../services/revisionCoachService.js';

test('revision coach parses mixed reviewer comments into priorities', () => {
  const reviewerText = `
Major Revision:
- Methodology is unclear and needs stronger justification.
- Citations are weak in section 3.

Minor:
Grammar should be improved in conclusion.
`;

  const { stageResult, roadmap } = runRevisionCoach(reviewerText);

  assert.equal(stageResult.source, 'revisionCoach');
  assert.ok(roadmap.items.length >= 2);
  assert.ok(roadmap.items.some((item) => item.priority === 'P1'));
});

