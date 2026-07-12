varying float vAlpha;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;

  float halo = smoothstep(0.5, 0.0, d);   // soft outer glow, isotope color
  float core = smoothstep(0.18, 0.0, d);  // tight bright core, white-hot
  vec3 color = mix(vColor, vec3(1.0), core);
  float alpha = max(halo * 0.55, core);

  gl_FragColor = vec4(color, alpha * vAlpha);
}