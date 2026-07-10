// Radial streak lines fired outward from a fission point, growing fast then
// fading — the classic manga/anime "impact speed lines" look. Each line is
// two vertices sharing the same origin/direction/color, distinguished by
// aIsEnd so the shader knows which end of the segment it's computing.

uniform float uTime;
attribute float aIsEnd;
attribute vec3 aOrigin;
attribute vec3 aDirection;
attribute float aStartTime;
attribute vec3 aColor;

varying float vAlpha;
varying vec3 vColor;

const float LIFETIME = 0.22;
const float LINE_LENGTH = 1.8;

void main() {
  float age = uTime - aStartTime;
  float t = clamp(age / LIFETIME, 0.0, 1.0);
  vAlpha = 1.0 - t;
  vColor = aColor;

  float reach = LINE_LENGTH * (0.2 + t * 0.8);
  float innerOffset = reach * 0.35;
  vec3 pos = aOrigin + aDirection * (aIsEnd > 0.5 ? reach : innerOffset);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}