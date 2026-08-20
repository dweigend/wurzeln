/*
 * Instanced tree vertex stage with a staggered grow-from-ground reveal.
 * The GLB geometry remains static and all instances share one phase uniform.
 */

uniform float uReveal;

in float aRevealDelay;

out vec2 vUv;
out vec3 vNormal;

void main() {
  float reveal = smoothstep(aRevealDelay, min(1.0, aRevealDelay + 0.34), uReveal);
  vec3 localPosition = position;
  localPosition.z *= reveal;
  vec4 worldPosition = modelMatrix * instanceMatrix * vec4(localPosition, 1.0);
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}

