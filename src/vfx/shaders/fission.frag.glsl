// Soft round glow, fading + desaturating toward white-hot at birth then
// fading to transparent at death. Cheap anime-glow look: circular falloff
// plus an additive-friendly alpha (set THREE.AdditiveBlending on the material).

varying float vLife;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  if (d > 0.5) discard;

  float core = smoothstep(0.5, 0.0, d);           // soft round falloff
  float hot = 1.0 - smoothstep(0.0, 0.35, vLife);  // white-hot at birth
  vec3 color = mix(vColor, vec3(1.0), hot);

  float alpha = core * (1.0 - vLife);
  gl_FragColor = vec4(color, alpha);
}
