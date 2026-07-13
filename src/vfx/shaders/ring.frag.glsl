varying float vAlive;

void main() {
  if (vAlive < 0.5) discard;
  gl_FragColor = vec4(0.62, 0.84, 1.0, 0.45);
}