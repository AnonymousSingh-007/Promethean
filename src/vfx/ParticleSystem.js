import * as THREE from 'three';
import { EVENTS } from '../physics/ChainReaction.js';
import { CurlNoiseField } from './CurlNoiseField.js';
import fissionVert from './shaders/fission.vert.glsl?raw';
import fissionFrag from './shaders/fission.frag.glsl?raw';
import trailVert from './shaders/trail.vert.glsl?raw';
import trailFrag from './shaders/trail.frag.glsl?raw';

const MAX_BURST_PARTICLES = 4000;
const MAX_TRAIL_PARTICLES = 800;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.clock = { time: 0 };
    this.curl = new CurlNoiseField();

    this._initBurstSystem();
    this._initTrailSystem();

    this._burstCursor = 0;
    this._trailCursor = 0;
    this._activeTrails = new Map(); // neutronId -> { index, from, to, spawnTime }
  }

  /** Wire this up once you have a live ChainReaction + HitStop instance. */
  attachTo(chainReaction, hitStop) {
    chainReaction.on(EVENTS.NEUTRON_SPAWNED, (e) => this._spawnTrail(e));
    chainReaction.on(EVENTS.NEUTRON_ARRIVED, (e) => this._retireTrail(e));
    chainReaction.on(EVENTS.ATOM_FISSIONED, (e) => {
      this._spawnBurst(e.position, e.energy);
      hitStop?.trigger({ energy: e.energy });
    });
  }

  // --- Fission burst points -------------------------------------------------

  _initBurstSystem() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_BURST_PARTICLES * 3);
    const velocities = new Float32Array(MAX_BURST_PARTICLES * 3);
    const startTimes = new Float32Array(MAX_BURST_PARTICLES).fill(-999);
    const sizes = new Float32Array(MAX_BURST_PARTICLES);
    const colors = new Float32Array(MAX_BURST_PARTICLES * 3);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('aStartTime', new THREE.BufferAttribute(startTimes, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader: fissionVert,
      fragmentShader: fissionFrag,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.burstPoints = new THREE.Points(geo, mat);
    this.scene.add(this.burstPoints);
  }

  _spawnBurst(position, energy, particleCount = 40, color = [1, 0.6, 0.3]) {
    const geo = this.burstPoints.geometry;
    const posAttr = geo.attributes.position;
    const velAttr = geo.attributes.aVelocity;
    const startAttr = geo.attributes.aStartTime;
    const sizeAttr = geo.attributes.aSize;
    const colorAttr = geo.attributes.aColor;

    const speed = 2 + energy / 60;

    for (let i = 0; i < particleCount; i++) {
      const idx = this._burstCursor;
      this._burstCursor = (this._burstCursor + 1) % MAX_BURST_PARTICLES;

      posAttr.setXYZ(idx, position.x, position.y, position.z);

      const dir = randomOnSphere();
      velAttr.setXYZ(idx, dir.x * speed, dir.y * speed, dir.z * speed);

      startAttr.setX(idx, this.clock.time);
      sizeAttr.setX(idx, 8 + Math.random() * 6);
      colorAttr.setXYZ(idx, color[0], color[1], color[2]);
    }

    posAttr.needsUpdate = true;
    velAttr.needsUpdate = true;
    startAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  // --- Neutron trail points (curl-noise advected) -------------------------

  _initTrailSystem() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_TRAIL_PARTICLES * 3);
    const births = new Float32Array(MAX_TRAIL_PARTICLES).fill(-999);
    const sizes = new Float32Array(MAX_TRAIL_PARTICLES);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(births, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: trailVert,
      fragmentShader: trailFrag,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.trailPoints = new THREE.Points(geo, mat);
    this.scene.add(this.trailPoints);
  }

  _spawnTrail({ id, from, to }) {
    const idx = this._trailCursor;
    this._trailCursor = (this._trailCursor + 1) % MAX_TRAIL_PARTICLES;
    this._activeTrails.set(id, { index: idx, from, to, spawnTime: this.clock.time, pos: { ...from } });
    this.trailPoints.geometry.attributes.aBirth.setX(idx, this.clock.time);
    this.trailPoints.geometry.attributes.aSize.setX(idx, 6);
  }

  _retireTrail({ id }) {
    // Just let it fade via the shader's TRAIL_LIFETIME — no need to hard-remove,
    // keeps this O(1) instead of shuffling the buffer.
    this._activeTrails.delete(id);
  }

  // --- Per-frame update -----------------------------------------------------

  update(dt) {
    this.clock.time += dt;
    this.burstPoints.material.uniforms.uTime.value = this.clock.time;
    this.trailPoints.material.uniforms.uTime.value = this.clock.time;

    const posAttr = this.trailPoints.geometry.attributes.position;
    const NEUTRON_TRAVEL_TIME = 0.35; // must match ChainReaction.js — consider lifting to a shared constants file

    for (const [, trail] of this._activeTrails) {
      const t = Math.min(1, (this.clock.time - trail.spawnTime) / NEUTRON_TRAVEL_TIME);
      const lerped = {
        x: lerp(trail.from.x, trail.to.x, t),
        y: lerp(trail.from.y, trail.to.y, t),
        z: lerp(trail.from.z, trail.to.z, t),
      };
      // fake-fluid wobble on top of the straight-line lerp, so it doesn't look robotic
      const curl = this.curl.sample(lerped, this.clock.time);
      trail.pos = { x: lerped.x + curl.x, y: lerped.y + curl.y, z: lerped.z + curl.z };
      posAttr.setXYZ(trail.index, trail.pos.x, trail.pos.y, trail.pos.z);
    }
    posAttr.needsUpdate = true;
  }
}

function randomOnSphere() {
  const u = Math.random(), v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: Math.sin(phi) * Math.sin(theta),
    z: Math.cos(phi),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
