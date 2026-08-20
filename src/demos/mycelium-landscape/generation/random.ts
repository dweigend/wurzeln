/**
 * Deterministic random source shared by landscape placement generators.
 * It intentionally exposes only the next normalized value.
 */

export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (1_664_525 * state + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
