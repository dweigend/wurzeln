/*
 * Cheap textured tree shading with alpha-tested leaves for predictable VR cost.
 * A color tint aligns the CC0 asset with the landscape experiment palette.
 */

uniform sampler2D uMap;
uniform float uAlphaCutoff;
uniform vec3 uTint;

in vec2 vUv;
in vec3 vNormal;

out vec4 outColor;

void main() {
  vec4 texel = texture(uMap, vUv);
  if (texel.a < uAlphaCutoff) discard;
  float light = max(dot(normalize(vNormal), normalize(vec3(0.35, 0.85, 0.25))), 0.0);
  float diffuse = 0.48 + light * 0.52;
  outColor = vec4(texel.rgb * uTint * diffuse, 1.0);
}
