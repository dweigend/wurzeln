/*
 * Cheap opaque shading for procedural mycelial tubes.
 * It avoids texture sampling, transparency, and dynamic lights so the cost
 * remains predictable for large WebGL2 instance counts in stereo rendering.
 */

uniform vec3 uFogColor;
uniform float uFogDensity;

in vec3 vNormal;
in float vReinforcement;
in float vMaturity;
in float vViewDepth;

out vec4 outColor;

void main() {
  vec3 lightDirection = normalize(vec3(0.45, 0.8, 0.35));
  float diffuse = 0.36 + max(dot(normalize(vNormal), lightDirection), 0.0) * 0.64;
  float cordBrightness = smoothstep(0.18, 0.86, vReinforcement) * vMaturity;
  vec3 fineHypha = vec3(0.72, 0.70, 0.63);
  vec3 transportCord = vec3(1.0, 0.98, 0.88);
  vec3 color = mix(fineHypha, transportCord, cordBrightness) * diffuse;
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * vViewDepth * vViewDepth);
  outColor = vec4(mix(color, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
}
