/*
 * Opaque dithered soil shading for stable WebGL2 transparency in stereo VR.
 * Fragment rejection reveals the subsurface without blended-surface sorting.
 */

uniform float uSubsurfaceVisible;
uniform float uMinimumHeight;
uniform float uMaximumHeight;

in vec3 vNormal;
in vec3 vPosition;
in vec2 vUv;

out vec4 outColor;

float hash(vec2 value) {
  return fract(sin(dot(value, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float coverage = mix(1.0, 0.3, uSubsurfaceVisible);
  float dither = hash(floor(gl_FragCoord.xy));
  if (dither > coverage) discard;

  float heightRange = max(0.001, uMaximumHeight - uMinimumHeight);
  float height = clamp((vPosition.y - uMinimumHeight) / heightRange, 0.0, 1.0);
  float diffuse = 0.62 + max(dot(normalize(vNormal), normalize(vec3(0.35, 0.9, 0.25))), 0.0) * 0.38;
  vec3 lowColor = vec3(0.34, 0.18, 0.3);
  vec3 highColor = vec3(0.78, 0.62, 0.67);
  vec3 color = mix(lowColor, highColor, height) * diffuse;
  outColor = vec4(color, 1.0);
}
