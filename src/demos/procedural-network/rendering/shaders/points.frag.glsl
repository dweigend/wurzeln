/*
 * Opaque circular point-node fragment shader.
 * Pixels outside the disc are discarded instead of alpha blended.
 */

in float vPulse;
out vec4 outColor;

void main() {
  vec2 centered = gl_PointCoord - 0.5;
  float distanceFromCenter = length(centered);
  if (distanceFromCenter > 0.5) discard;
  float core = 1.0 - smoothstep(0.05, 0.5, distanceFromCenter);
  vec3 color = mix(vec3(0.88, 0.08, 0.06), vec3(1.0, 0.42, 0.18), core) * vPulse;
  outColor = vec4(color, 1.0);
}
