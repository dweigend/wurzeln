/*
 * Opaque emissive-like shading for visible underground mycelial tube surfaces.
 * It avoids lights, transparency, and postprocessing for predictable stereo cost.
 */

uniform vec3 uFogColor;
uniform float uFogDensity;

in vec3 vNormal;
in float vReinforcement;
in float vMaturity;
in float vViewDepth;

out vec4 outColor;

void main() {
  float diffuse = 0.62 + max(dot(normalize(vNormal), normalize(vec3(0.4, 0.8, 0.3))), 0.0) * 0.38;
  float cord = smoothstep(0.18, 0.86, vReinforcement) * vMaturity;
  vec3 fineHypha = vec3(0.75, 0.74, 0.82);
  vec3 transportCord = vec3(1.0, 0.98, 0.9);
  vec3 color = mix(fineHypha, transportCord, cord) * diffuse;
  float fog = 1.0 - exp(-uFogDensity * uFogDensity * vViewDepth * vViewDepth);
  outColor = vec4(mix(color, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
}

