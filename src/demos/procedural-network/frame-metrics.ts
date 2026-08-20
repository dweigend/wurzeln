/**
 * Small rolling frame-time sampler for experiment feedback.
 * It reports average FPS and p95 frame time without external dependencies.
 */

const SAMPLE_CAPACITY = 180;
const MAX_VALID_DELTA_SECONDS = 0.25;

export class FrameMetrics {
  private readonly samples = new Float32Array(SAMPLE_CAPACITY);
  private sampleCount = 0;
  private writeIndex = 0;

  add(deltaSeconds: number): void {
    if (deltaSeconds <= 0 || deltaSeconds > MAX_VALID_DELTA_SECONDS) return;
    this.samples[this.writeIndex] = deltaSeconds;
    this.writeIndex = (this.writeIndex + 1) % SAMPLE_CAPACITY;
    this.sampleCount = Math.min(SAMPLE_CAPACITY, this.sampleCount + 1);
  }

  get averageFramesPerSecond(): number {
    if (this.sampleCount === 0) return 0;
    let total = 0;
    for (let index = 0; index < this.sampleCount; index += 1) total += this.samples[index] ?? 0;
    return total > 0 ? this.sampleCount / total : 0;
  }

  get p95Milliseconds(): number {
    if (this.sampleCount === 0) return 0;
    const ordered = Array.from(this.samples.slice(0, this.sampleCount)).sort((a, b) => a - b);
    const index = Math.max(0, Math.ceil(ordered.length * 0.95) - 1);
    return (ordered[index] ?? 0) * 1_000;
  }
}
