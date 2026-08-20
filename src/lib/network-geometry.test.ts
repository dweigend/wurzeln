/**
 * Protects the shared GPU geometry contract used by both network adapters.
 * It verifies instance attributes, counts, and the explicit disposal event
 * without depending on a browser or WebGL context.
 */

import { describe, expect, test } from 'bun:test';
import { createNetwork } from './network-generator.ts';
import { createNetworkGeometry } from './network-geometry.ts';

describe('createNetworkGeometry', () => {
  test('maps generated hypha data to one instanced geometry', () => {
    const network = createNetwork({ kind: 'volume', seed: 31, pointCount: 32 });
    const geometry = createNetworkGeometry(network);

    expect(geometry.instanceCount).toBe(network.hyphaCount);
    expect(geometry.getAttribute('aStart').count).toBe(network.hyphaCount);
    expect(geometry.getAttribute('aStartTimeSeconds').count).toBe(network.hyphaCount);
    expect(geometry.getAttribute('aDurationSeconds').count).toBe(network.hyphaCount);
    expect(geometry.getAttribute('aReinforcement').count).toBe(network.hyphaCount);

    let disposed = false;
    geometry.addEventListener('dispose', () => { disposed = true; });
    geometry.dispose();
    expect(disposed).toBe(true);
  });
});
