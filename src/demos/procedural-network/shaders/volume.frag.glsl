/*
 * Opaque boundary-line shader for the procedural volume.
 * The deliberately simple output keeps the volume to one cheap draw call.
 */

out vec4 outColor;

void main() {
  outColor = vec4(0.22, 0.3, 0.28, 1.0);
}
