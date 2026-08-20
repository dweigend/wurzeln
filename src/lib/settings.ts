/**
 * Shared readonly contracts for generated mycelium networks.
 * The discriminant separates volume-generated points from caller-provided points;
 * mutable typed arrays are populated once and treated as immutable after creation.
 */

export const VOLUME_POINT_COUNT_LIMITS = Object.freeze({
  minimum: 16,
  maximum: 2_000,
});

type VolumeNetworkSettings = Readonly<{
  kind: 'volume';
  seed: number;
  pointCount: number;
}>;

type PointNetworkSettings = Readonly<{
  kind: 'points';
  seed: number;
  points: Float32Array;
  resourcePointIndices: readonly number[];
  minimumRadius: number;
  radiusVariation: number;
}>;

export type NetworkGenerationSettings = VolumeNetworkSettings | PointNetworkSettings;

export type GeneratedNetwork = Readonly<{
  points: Float32Array;
  connections: Uint32Array;
  starts: Float32Array;
  ends: Float32Array;
  seeds: Float32Array;
  startTimesSeconds: Float32Array;
  durationsSeconds: Float32Array;
  radii: Float32Array;
  reinforcements: Float32Array;
  hyphaCount: number;
  reinforcedHyphaCount: number;
}>;
