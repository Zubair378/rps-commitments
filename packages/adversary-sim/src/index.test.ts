import { describe, expect, it } from 'vitest';
import { ATTACKS, runAttack } from './index.js';

describe('isolated attack demonstrations', () => {
  for (const attack of ATTACKS) {
    it(`${attack.id}: succeeds against the weak example and fails against the defense`, async () => {
      const result = await runAttack(attack.id);
      expect(result.vulnerableSuccess).toBe(true);
      expect(result.patchedBlocked).toBe(true);
      expect(result.evidence.length).toBeGreaterThan(20);
    });
  }
});
