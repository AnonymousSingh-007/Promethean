varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;

  float glow = smoothstep(0.5, 0.0, d);
  vec3 color = vec3(0.6, 0.85, 1.0); // pale cyan-blue "neutrino" tint, override per-isotope if desired
  gl_FragColor = vec4(color, glow * vAlpha);
}
