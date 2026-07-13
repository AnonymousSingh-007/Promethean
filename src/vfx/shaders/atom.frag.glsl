uniform vec3 uColor;
varying float vAlive;
varying float vPulse;

void main() {
  if (vAlive < 0.5) discard; // fissioned atoms simply don't draw — no per-frame JS work needed to "hide" them
  vec3 emissive = uColor * vPulse * 1.9;
  gl_FragColor = vec4(emissive, 1.0);
}