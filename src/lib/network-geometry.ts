/**
 * Builds the shared instanced tube geometry consumed by both network views.
 * It owns only geometry creation; concrete adapters own materials, scene nodes,
 * shader semantics, and disposal of the returned geometry.
 */

import {
  CylinderGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
} from 'three';
import type { GeneratedNetwork } from './settings.ts';

const RADIAL_SEGMENTS = 3;
const LONGITUDINAL_SEGMENTS = 16;

export const TRIANGLES_PER_HYPHA = RADIAL_SEGMENTS * LONGITUDINAL_SEGMENTS * 2;

export function createNetworkGeometry(network: GeneratedNetwork): InstancedBufferGeometry {
  const base = new CylinderGeometry(
    1,
    1,
    1,
    RADIAL_SEGMENTS,
    LONGITUDINAL_SEGMENTS,
    true,
  );
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex(base.getIndex());
  geometry.setAttribute('position', base.getAttribute('position'));
  geometry.setAttribute('aStart', new InstancedBufferAttribute(network.starts, 3));
  geometry.setAttribute('aEnd', new InstancedBufferAttribute(network.ends, 3));
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(network.seeds, 1));
  geometry.setAttribute(
    'aStartTimeSeconds',
    new InstancedBufferAttribute(network.startTimesSeconds, 1),
  );
  geometry.setAttribute(
    'aDurationSeconds',
    new InstancedBufferAttribute(network.durationsSeconds, 1),
  );
  geometry.setAttribute('aRadius', new InstancedBufferAttribute(network.radii, 1));
  geometry.setAttribute(
    'aReinforcement',
    new InstancedBufferAttribute(network.reinforcements, 1),
  );
  geometry.instanceCount = network.hyphaCount;
  base.dispose();
  return geometry;
}
