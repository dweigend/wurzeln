/*
 * Terrain vertex stage for the generated height field.
 * It keeps geometry static and only lowers it during the reveal transition.
 */

uniform float uTerrainReveal;

out vec3 vNormal;
out vec3 vPosition;
out vec2 vUv;

void main() {
  vec3 localPosition = position;
  localPosition.y -= (1.0 - uTerrainReveal) * 2.0;
  vec4 worldPosition = modelMatrix * vec4(localPosition, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vPosition = worldPosition.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
