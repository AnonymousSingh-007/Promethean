uniform float uTime;
attribute float aPhase;
attribute float aAlive;

varying float vAlive;
varying float vPulse;

void main() {
  vAlive = aAlive;
  float pulse = 0.55 + sin(uTime * 2.0 + aPhase) * 0.18;
  vPulse = pulse;
  float scale = 1.0 + sin(uTime * 1.5 + aPhase) * 0.03;

  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position * scale, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}