/*
 * Cheap opaque shading for procedural tendril tubes.
 * It avoids texture sampling, transparency, and dynamic lights so the cost
 * remains predictable for large WebGL2 instance counts in stereo rendering.
 */

uniform vec3 uFogColor;
uniform float uFogDensity;

in vec3 vNormal;
in float vKind;
in float vStrength;
in float vViewDepth;

out vec4 outColor;

void main() {
  vec3 lightDirection = normalize(vec3(0.45, 0.8, 0.35));
  float diffuse = 0.36 + max(dot(normalize(vNormal), lightDirection), 0.0) * 0.64;
  vec3 exploratoryColor = vec3(0.95, 0.22, 0.16);
  vec3 stableColor = mix(vec3(0.12, 0.55, 0.42), vec3(0.52, 0.98, 0.72), vStrength);
  vec3 color = mix(exploratoryColor, stableColor, step(0.5, vKind)) * diffuse;
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * vViewDepth * vViewDepth);
  outColor = vec4(mix(color, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
}
