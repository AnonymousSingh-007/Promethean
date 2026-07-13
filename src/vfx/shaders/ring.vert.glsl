uniform float uTime;
attribute float aPhase;
attribute float aSpin;
attribute float aAlive;

varying float vAlive;

void main() {
  vAlive = aAlive;
  float angle = uTime * aSpin + aPhase;
  float s = sin(angle), c = cos(angle);
  vec3 pos = position;
  vec3 rotated = vec3(pos.x * c - pos.y * s, pos.x * s + pos.y * c, pos.z);

  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(rotated, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}