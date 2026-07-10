uniform float uTime;
attribute float aBirth;
attribute float aSize;

varying float vAlpha;

const float TRAIL_LIFETIME = 0.55; // slightly longer than NEUTRON_TRAVEL_TIME so the tail is visible on arrival

void main() {
  float age = uTime - aBirth;
  vAlpha = clamp(1.0 - age / TRAIL_LIFETIME, 0.0, 1.0);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (200.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}