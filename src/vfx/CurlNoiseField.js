// Cheap "fluid-looking" motion without solving Navier-Stokes.
// Curl of a noise field is divergence-free by construction, which is exactly
// the property that makes smoke/fluid advection look right (no particles
// piling up or spreading from nowhere). We compute it via finite differences
// on a classic Perlin/simplex-ish value noise — good enough at particle scale,
// and cheap enough to run per-particle per-frame in JS for a few hundred particles.
// (If you scale to thousands, port this into trail.vert.glsl and do it on GPU instead —
// the math is identical, just swap JS Math for GLSL.)

const EPS = 0.0001;

export class CurlNoiseField {
  constructor({ scale = 0.5, timeScale = 0.3, seed = 1337 } = {}) {
    this.scale = scale;
    this.timeScale = timeScale;
    this.seed = seed;
  }

  /** Returns a {x,y,z} velocity vector at the given position and time. */
  sample(pos, time) {
    const t = time * this.timeScale;

    const n1 = this._noise3(pos.x, pos.y + EPS, pos.z, t) - this._noise3(pos.x, pos.y - EPS, pos.z, t);
    const n2 = this._noise3(pos.x, pos.y, pos.z + EPS, t) - this._noise3(pos.x, pos.y, pos.z - EPS, t);
    const x = (n1 - n2) / (2 * EPS);

    const n3 = this._noise3(pos.x, pos.y, pos.z + EPS, t) - this._noise3(pos.x, pos.y, pos.z - EPS, t);
    const n4 = this._noise3(pos.x + EPS, pos.y, pos.z, t) - this._noise3(pos.x - EPS, pos.y, pos.z, t);
    const y = (n3 - n4) / (2 * EPS);

    const n5 = this._noise3(pos.x + EPS, pos.y, pos.z, t) - this._noise3(pos.x - EPS, pos.y, pos.z, t);
    const n6 = this._noise3(pos.x, pos.y + EPS, pos.z, t) - this._noise3(pos.x, pos.y - EPS, pos.z, t);
    const z = (n5 - n6) / (2 * EPS);

    return { x: x * 0.02, y: y * 0.02, z: z * 0.02 }; // scaled down; tune to taste against particle speed
  }

  // Minimal hash-based value noise — swap for a real simplex noise lib if you want
  // smoother fields, this is deliberately dependency-free for a weekend build.
  _noise3(x, y, z, t) {
    const s = this.scale;
    const h = Math.sin((x * s + this.seed) * 12.9898 + (y * s) * 78.233 + (z * s + t) * 37.719) * 43758.5453;
    return h - Math.floor(h);
  }
}
