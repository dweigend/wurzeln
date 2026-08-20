/*
 * Terrain vertex stage for the generated height field.
 * It keeps the generated surface static between live parameter rebuilds.
 */

out vec3 vNormal;
out vec3 vPosition;
out vec2 vUv;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vPosition = worldPosition.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
