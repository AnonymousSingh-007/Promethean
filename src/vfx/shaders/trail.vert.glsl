uniform float uTime;
attribute float aBirth;
attribute float aSize;
attribute vec3 aColor;

varying float vAlpha;
varying vec3 vColor;

const float TRAIL_LIFETIME = 0.55;

void main() {
  float age = uTime - aBirth;
  vAlpha = clamp(1.0 - age / TRAIL_LIFETIME, 0.0, 1.0);
  vColor = aColor;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (200.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}