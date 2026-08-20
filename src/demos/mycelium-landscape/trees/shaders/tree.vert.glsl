/*
 * Instanced tree vertex stage for immutable live-generated placements.
 * Layer visibility is handled by the Three.js object rather than shader state.
 */

out vec2 vUv;
out vec3 vNormal;

void main() {
  vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
