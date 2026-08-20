/**
 * Generates and samples one deterministic Perlin-noise height field.
 * World-space sampling is the single source for terrain, trees, and network.
 */

import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

const TERRAIN_RESOLUTION = 97;

const OCTAVE_COUNT = 4;
const BASE_FREQUENCY = 0.045;
const HEIGHT_RATIO = 0.12;

export type HeightField = Readonly<{
  sizeMeters: number;
  resolution: number;
  heights: Float32Array;
  minimumHeight: number;
  maximumHeight: number;
}>;

type HeightFieldOptions = Readonly<{
  sizeMeters: number;
  seed: number;
  resolution?: number;
}>;

type TerrainHeightContext = {
  noise: ImprovedNoise;
  x: number;
  z: number;
  sizeMeters: number;
  seed: number;
};

export function createHeightField(options: HeightFieldOptions): HeightField {
  const resolution = options.resolution ?? TERRAIN_RESOLUTION;
  const heights = new Float32Array(resolution * resolution);
  const noise = new ImprovedNoise();
  let minimumHeight = Number.POSITIVE_INFINITY;
  let maximumHeight = Number.NEGATIVE_INFINITY;

  for (let z = 0; z < resolution; z += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const worldX = gridToWorld(x, resolution, options.sizeMeters);
      const worldZ = gridToWorld(z, resolution, options.sizeMeters);
      const height = terrainHeight({
        noise,
        x: worldX,
        z: worldZ,
        sizeMeters: options.sizeMeters,
        seed: options.seed,
      });
      heights[z * resolution + x] = height;
      minimumHeight = Math.min(minimumHeight, height);
      maximumHeight = Math.max(maximumHeight, height);
    }
  }

  return {
    sizeMeters: options.sizeMeters,
    resolution,
    heights,
    minimumHeight,
    maximumHeight,
  };
}

export function sampleHeight(field: Readonly<HeightField>, x: number, z: number): number {
  const gridX = worldToGrid(x, field);
  const gridZ = worldToGrid(z, field);
  const x0 = Math.floor(gridX);
  const z0 = Math.floor(gridZ);
  const x1 = Math.min(field.resolution - 1, x0 + 1);
  const z1 = Math.min(field.resolution - 1, z0 + 1);
  const horizontal = gridX - x0;
  const vertical = gridZ - z0;
  const top = mix(heightAt(field, x0, z0), heightAt(field, x1, z0), horizontal);
  const bottom = mix(heightAt(field, x0, z1), heightAt(field, x1, z1), horizontal);
  return mix(top, bottom, vertical);
}

export function sampleSlope(field: Readonly<HeightField>, x: number, z: number): number {
  const step = field.sizeMeters / (field.resolution - 1);
  const dx = sampleHeight(field, x + step, z) - sampleHeight(field, x - step, z);
  const dz = sampleHeight(field, x, z + step) - sampleHeight(field, x, z - step);
  return Math.hypot(dx, dz) / (step * 2);
}

function terrainHeight(context: Readonly<TerrainHeightContext>): number {
  let amplitude = 1;
  let frequency = BASE_FREQUENCY;
  let value = 0;
  let weight = 0;
  const seedOffset = context.seed * 0.0137;

  for (let octave = 0; octave < OCTAVE_COUNT; octave += 1) {
    value +=
      context.noise.noise(context.x * frequency, context.z * frequency, seedOffset) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return (value / weight) * context.sizeMeters * HEIGHT_RATIO;
}

function gridToWorld(index: number, resolution: number, sizeMeters: number): number {
  return (index / (resolution - 1) - 0.5) * sizeMeters;
}

function worldToGrid(value: number, field: Readonly<HeightField>): number {
  const normalized = value / field.sizeMeters + 0.5;
  return Math.min(field.resolution - 1, Math.max(0, normalized * (field.resolution - 1)));
}

function heightAt(field: Readonly<HeightField>, x: number, z: number): number {
  return field.heights[z * field.resolution + x] ?? 0;
}

function mix(first: number, second: number, factor: number): number {
  return first + (second - first) * factor;
}
