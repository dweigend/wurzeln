/*
 * Procedural GLSL3 tube deformation for stable and decaying tendrils.
 * A shared low-poly cylinder is bent between two endpoints; growth and radius
 * animation are derived analytically from time and immutable instance data.
 */

uniform float uTime;
uniform float uVolumeScale;

in vec3 aStart;
in vec3 aEnd;
in float aSeed;
in float aStartTime;
in float aDuration;
in float aRadius;
in float aKind;

out vec3 vNormal;
out float vKind;
out float vStrength;
out float vViewDepth;

const float PI = 3.141592653589793;

float hash(float value) {
  return fract(sin(value * 91.731) * 47593.5453);
}

vec3 safeDirection(vec3 vector) {
  float vectorLength = length(vector);
  return vectorLength > 0.00001 ? vector / vectorLength : vec3(0.0, 1.0, 0.0);
}

vec3 sideFor(vec3 direction) {
  vec3 reference = abs(direction.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  return safeDirection(cross(direction, reference));
}

vec3 centerline(float parameter) {
  vec3 direct = aEnd - aStart;
  float directLength = max(length(direct), 0.0001);
  vec3 direction = safeDirection(direct);
  vec3 side = sideFor(direction);
  vec3 up = safeDirection(cross(side, direction));
  vec3 base = mix(aStart, aEnd, parameter);
  float boundaryDistance = 0.48 - max(max(abs(base.x), abs(base.y)), abs(base.z));
  float amplitude = min(directLength * 0.16, max(0.0, boundaryDistance * 0.65));
  float envelope = sin(PI * parameter);
  float frequencyA = 1.5 + hash(aSeed) * 3.0;
  float frequencyB = 2.0 + hash(aSeed + 7.1) * 4.0;
  float waveA = sin((parameter * frequencyA + hash(aSeed + 2.3)) * PI * 2.0);
  float waveB = sin((parameter * frequencyB + hash(aSeed + 5.7)) * PI * 2.0);
  return base + (side * waveA + up * waveB * 0.72) * amplitude * envelope;
}

float visibleRadius(float parameter, float localAge) {
  float started = step(0.0, localAge);
  float growth = smoothstep(0.0, 1.0, clamp(localAge, 0.0, 1.0));
  float stablePath = step(0.5, aKind);
  float pathCoordinate = mix(parameter, min(parameter, 1.0 - parameter) * 2.0, stablePath);
  float revealed = 1.0 - smoothstep(growth, growth + 0.075, pathCoordinate);
  float decay = mix(1.0 - smoothstep(1.05, 1.45, localAge), 1.0, stablePath);
  float reinforcement = mix(1.0, mix(0.7, 1.75, smoothstep(1.0, 1.35, localAge)), stablePath);
  return aRadius * started * revealed * decay * reinforcement;
}

void main() {
  float parameter = position.y + 0.5;
  float localAge = (uTime - aStartTime) / max(aDuration, 0.001);
  float radius = visibleRadius(parameter, localAge);
  float epsilon = 0.0125;
  vec3 previous = centerline(max(0.0, parameter - epsilon));
  vec3 next = centerline(min(1.0, parameter + epsilon));
  vec3 tangent = safeDirection(next - previous);
  vec3 normal = sideFor(tangent);
  vec3 binormal = safeDirection(cross(normal, tangent));
  vec3 radialOffset = normal * position.x + binormal * position.z;
  vec3 localPosition = (centerline(parameter) + radialOffset * radius) * uVolumeScale;
  vec4 viewPosition = modelViewMatrix * vec4(localPosition, 1.0);

  vNormal = normalize(mat3(modelMatrix) * radialOffset);
  vKind = aKind;
  vStrength = smoothstep(0.85, 1.35, localAge);
  vViewDepth = -viewPosition.z;
  gl_Position = projectionMatrix * viewPosition;
}
