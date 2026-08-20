/*
 * Procedural point-node vertex shader for the network anchors.
 * Point size is perspective-scaled and capped to keep fill cost bounded.
 */

uniform float uTime;
uniform float uVolumeScale;
uniform float uPixelRatio;

out float vPulse;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position * uVolumeScale, 1.0);
  float perspectiveSize = 42.0 / max(1.0, -viewPosition.z);
  gl_PointSize = clamp(perspectiveSize * uPixelRatio, 2.0, 15.0);
  gl_Position = projectionMatrix * viewPosition;
  vPulse = 0.82 + sin(uTime * 1.8 + float(gl_VertexID) * 0.37) * 0.18;
}
