/*
 * Vertex shader for the procedural unit-volume boundary.
 * One scale uniform expands the complete experiment without rebuilding data.
 */

uniform float uVolumeSizeMeters;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * uVolumeSizeMeters, 1.0);
}
