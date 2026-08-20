/**
 * Verifies rolling frame diagnostics independently from browser rendering.
 * The tests cover valid samples and rejection of timing gaps outside the
 * documented measurement window.
 */

import { describe, expect, test } from 'bun:test';
import { FrameMetrics } from './frame-metrics.ts';

describe('FrameMetrics', () => {
  test('reports average FPS and p95 frame time', () => {
    const metrics = new FrameMetrics();
    for (let index = 0; index < 19; index += 1) metrics.recordFrame(0.01);
    metrics.recordFrame(0.02);

    expect(metrics.averageFramesPerSecond).toBeCloseTo(95.24, 1);
    expect(metrics.p95Milliseconds).toBeCloseTo(10, 3);
  });

  test('ignores invalid samples and long document pauses', () => {
    const metrics = new FrameMetrics();
    metrics.recordFrame(-1);
    metrics.recordFrame(0);
    metrics.recordFrame(0.5);

    expect(metrics.averageFramesPerSecond).toBe(0);
    expect(metrics.p95Milliseconds).toBe(0);
  });
});
