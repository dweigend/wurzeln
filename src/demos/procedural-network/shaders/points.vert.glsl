/*
 * Procedural point-node vertex shader for subtle substrate resource anchors.
 * Point size is perspective-scaled and capped to keep fill cost bounded.
 */

uniform float uTimeSeconds;
uniform float uVolumeSizeMeters;
uniform float uPixelRatio;

out float vPulse;
out float vVisibility;

void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position * uVolumeSizeMeters, 1.0);
  float perspectiveSize = 42.0 / max(1.0, -viewPosition.z);
  vVisibility = 1.0 - smoothstep(1.0, 5.0, uTimeSeconds);
  gl_PointSize = clamp(perspectiveSize * uPixelRatio * vVisibility, 0.0, 8.0);
  gl_Position = projectionMatrix * viewPosition;
  vPulse = 0.9 + sin(uTimeSeconds * 1.1 + float(gl_VertexID) * 0.37) * 0.1;
}
