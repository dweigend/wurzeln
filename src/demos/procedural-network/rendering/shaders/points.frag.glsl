/*
 * Opaque circular point-node fragment shader.
 * Pixels outside the disc are discarded instead of alpha blended.
 */

in float vPulse;
in float vVisibility;
out vec4 outColor;

void main() {
  if (vVisibility < 0.01) discard;
  vec2 centered = gl_PointCoord - 0.5;
  float distanceFromCenter = length(centered);
  if (distanceFromCenter > 0.5) discard;
  float core = 1.0 - smoothstep(0.05, 0.5, distanceFromCenter);
  vec3 color = mix(vec3(0.28, 0.25, 0.19), vec3(0.82, 0.77, 0.62), core) * vPulse;
  outColor = vec4(color, 1.0);
}
