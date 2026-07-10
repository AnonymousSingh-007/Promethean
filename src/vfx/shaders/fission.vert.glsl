// Instanced burst particle vertex shader.
// Each fission event spawns a batch of these; aStartTime + aVelocity drive
// a simple outward ballistic expansion, faded by fission.frag.glsl.

uniform float uTime;
attribute float aStartTime;
attribute vec3 aVelocity;
attribute float aSize;
attribute vec3 aColor;

varying float vLife;   // 0 = just born, 1 = dead
varying vec3 vColor;

const float LIFETIME = 0.9;

void main() {
  float age = uTime - aStartTime;
  vLife = clamp(age / LIFETIME, 0.0, 1.0);
  vColor = aColor;

  // outward drift with slight deceleration, reads as an energy burst rather than a flat explosion
  vec3 displaced = position + aVelocity * age * (1.0 - 0.3 * vLife);

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_PointSize = aSize * (1.0 - vLife) * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
