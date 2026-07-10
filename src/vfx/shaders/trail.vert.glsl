// Trail particles for in-flight neutrons. Position is updated on the CPU
// each frame (see ParticleSystem.js -> curl noise advection) and pushed in
// via the position attribute directly, so this shader just handles size/fade.

uniform float uTime;
attribute float aBirth;
attribute float aSize;

varying float vAlpha;

const float TRAIL_LIFETIME = 0.4;

void main() {
  float age = uTime - aBirth;
  vAlpha = clamp(1.0 - age / TRAIL_LIFETIME, 0.0, 1.0);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (200.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
