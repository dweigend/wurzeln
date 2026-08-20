/*
 * Vertex shader for the procedural unit-volume boundary.
 * One scale uniform expands the complete experiment without rebuilding data.
 */

uniform float uVolumeScale;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * uVolumeScale, 1.0);
}
