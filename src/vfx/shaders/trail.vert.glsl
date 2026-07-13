uniform float uTime;
attribute float aBirth;
attribute float aSize;
attribute vec3 aColor;
attribute float aTravelTime;

varying float vAlpha;
varying vec3 vColor;

const float FADE_PAD = 0.15;

void main() {
  float age = uTime - aBirth;
  float totalLife = aTravelTime + FADE_PAD;
  vAlpha = clamp(1.0 - age / totalLife, 0.0, 1.0);
  vColor = aColor;

  float travelT = clamp(age / aTravelTime, 0.0, 1.0);
  float growth = 1.0 + travelT * 0.6;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  // Clamp the divisor so point size can't explode when a neutron spawns
  // very close to the camera (the fixed origin distance was the actual bug —
  // this clamp is just a safety net against the same class of issue recurring).
  gl_PointSize = aSize * growth * (240.0 / max(2.5, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
}