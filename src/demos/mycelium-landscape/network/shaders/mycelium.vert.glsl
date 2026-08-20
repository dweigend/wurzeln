/*
 * Procedural underground tube deformation constrained by the terrain height map.
 * An explicit UI action controls growth before transport reinforcement matures.
 */

uniform float uTimeSeconds;
uniform float uTerrainSizeMeters;
uniform sampler2D uHeightMap;

in vec3 aStart;
in vec3 aEnd;
in float aSeed;
in float aStartTimeSeconds;
in float aDurationSeconds;
in float aRadius;
in float aReinforcement;

out vec3 vNormal;
out float vReinforcement;
out float vMaturity;

const float PI = 3.141592653589793;
const float TERRAIN_COVER = 0.02;

float hash(float value) {
  return fract(sin(value * 91.731) * 47593.5453);
}

vec3 safeDirection(vec3 value) {
  float valueLength = length(value);
  return valueLength > 0.00001 ? value / valueLength : vec3(0.0, 1.0, 0.0);
}

vec3 sideFor(vec3 direction) {
  vec3 reference = abs(direction.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  return safeDirection(cross(direction, reference));
}

float terrainHeight(vec2 positionXZ) {
  vec2 uv = clamp(positionXZ / uTerrainSizeMeters + 0.5, 0.0, 1.0);
  return texture(uHeightMap, uv).r;
}

vec3 centerline(float parameter) {
  vec3 direct = aEnd - aStart;
  float directLength = max(length(direct), 0.0001);
  vec3 base = mix(aStart, aEnd, parameter);
  vec2 horizontal = normalize(direct.xz + vec2(0.0001, 0.0));
  vec2 side = vec2(-horizontal.y, horizontal.x);
  float envelope = sin(PI * parameter);
  float wave = sin((parameter * (0.8 + hash(aSeed) * 1.2) + hash(aSeed + 2.3)) * PI * 2.0);
  float verticalWave = abs(sin((parameter * 1.4 + hash(aSeed + 7.1)) * PI * 2.0));
  float amplitude = min(directLength * 0.1, uTerrainSizeMeters * 0.018);
  base.xz += side * wave * amplitude * envelope;
  base.y -= verticalWave * amplitude * 0.45 * envelope;
  base.y = min(base.y, terrainHeight(base.xz) - TERRAIN_COVER);
  return base;
}

float visibleRadius(float parameter, float localAge) {
  float started = step(0.0, localAge);
  float growth = smoothstep(0.0, 1.0, clamp(localAge, 0.0, 1.0));
  float pathCoordinate = min(parameter, 1.0 - parameter) * 2.0;
  float revealed = 1.0 - smoothstep(growth, growth + 0.075, pathCoordinate);
  float maturity = smoothstep(1.05, 2.6, localAge);
  float matureRadius = aRadius * mix(0.36, 7.0, pow(aReinforcement, 1.8));
  return mix(aRadius, matureRadius, maturity) * started * revealed;
}

void main() {
  float parameter = position.y + 0.5;
  float localAge = (uTimeSeconds - aStartTimeSeconds) / max(aDurationSeconds, 0.001);
  float radius = visibleRadius(parameter, localAge);
  float epsilon = 0.0125;
  vec3 tangent = safeDirection(
    centerline(min(1.0, parameter + epsilon)) - centerline(max(0.0, parameter - epsilon))
  );
  vec3 normal = sideFor(tangent);
  vec3 binormal = safeDirection(cross(normal, tangent));
  vec3 radialOffset = normal * position.x + binormal * position.z;
  vec3 localPosition = centerline(parameter) + radialOffset * radius;
  vec4 viewPosition = modelViewMatrix * vec4(localPosition, 1.0);

  vNormal = normalize(mat3(modelMatrix) * radialOffset);
  vReinforcement = aReinforcement;
  vMaturity = smoothstep(1.05, 2.6, localAge);
  gl_Position = projectionMatrix * viewPosition;
}
