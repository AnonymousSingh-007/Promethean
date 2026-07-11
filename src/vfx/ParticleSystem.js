import * as THREE from 'three';
import { EVENTS } from '../physics/ChainReaction.js';
import { ISOTOPES } from '../physics/IsotopeData.js';
import { CurlNoiseField } from './CurlNoiseField.js';
import fissionVert from './shaders/fission.vert.glsl?raw';
import fissionFrag from './shaders/fission.frag.glsl?raw';
import trailVert from './shaders/trail.vert.glsl?raw';
import trailFrag from './shaders/trail.frag.glsl?raw';
import speedlineVert from './shaders/speedline.vert.glsl?raw';
import speedlineFrag from './shaders/speedline.frag.glsl?raw';

const MAX_BURST_PARTICLES = 4000;
const MAX_TRAIL_PARTICLES = 800;
const MAX_SPEEDLINE_SEGMENTS = 1200;
const FADE_TAIL = 0.15;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.clock = { time: 0 };
    this.curl = new CurlNoiseField();

    this._initBurstSystem();
    this._initTrailSystem();
    this._initTrailLineSystem();
    this._initSpeedLineSystem();

    this._burstCursor = 0;
    this._trailCursor = 0;
    this._speedLineCursor = 0;
    this._activeTrails = new Map();
  }

  attachTo(chainReaction, hitStop) {
    chainReaction.on(EVENTS.NEUTRON_SPAWNED, (e) => this._spawnTrail(e));
    chainReaction.on(EVENTS.ATOM_FISSIONED, (e) => {
      const color = ISOTOPES[e.isotopeId]?.color ?? 0xffffff;
      this._spawnBurst(e.position, e.energy);
      this._spawnSpeedLineBurst(e.position, color);
      hitStop?.trigger({ energy: e.energy });
    });
  }

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

  _spawnBurst(position, energy, particleCount = 50, color = [1, 0.6, 0.3]) {
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
      sizeAttr.setX(idx, 10 + Math.random() * 8);
      colorAttr.setXYZ(idx, color[0], color[1], color[2]);
    }

    posAttr.needsUpdate = true;
    velAttr.needsUpdate = true;
    startAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  _initTrailSystem() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_TRAIL_PARTICLES * 3);
    const births = new Float32Array(MAX_TRAIL_PARTICLES).fill(-999);
    const sizes = new Float32Array(MAX_TRAIL_PARTICLES);
    const colors = new Float32Array(MAX_TRAIL_PARTICLES * 3);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aBirth', new THREE.BufferAttribute(births, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

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

  _initTrailLineSystem() {
    const geo = new THREE.BufferGeometry();
    const count = MAX_TRAIL_PARTICLES * 2;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.trailLines = new THREE.LineSegments(geo, mat);
    this.scene.add(this.trailLines);
  }

  _spawnTrail({ id, from, to, isotopeId, travelTime }) {
    const idx = this._trailCursor;
    this._trailCursor = (this._trailCursor + 1) % MAX_TRAIL_PARTICLES;

    const colorHex = ISOTOPES[isotopeId]?.color ?? 0x9fd6ff;
    const rgb = hexToRgb(colorHex);

    this._activeTrails.set(id, {
      index: idx, from, to, spawnTime: this.clock.time, travelTime,
      prevPos: { ...from }, colorArr: [rgb.r, rgb.g, rgb.b],
    });

    this.trailPoints.geometry.attributes.aBirth.setX(idx, this.clock.time);
    this.trailPoints.geometry.attributes.aSize.setX(idx, 10);
    this.trailPoints.geometry.attributes.aColor.setXYZ(idx, rgb.r, rgb.g, rgb.b);
  }

  _initSpeedLineSystem() {
    const geo = new THREE.BufferGeometry();
    const count = MAX_SPEEDLINE_SEGMENTS * 2;
    const position = new Float32Array(count * 3);
    const isEnd = new Float32Array(count);
    const origin = new Float32Array(count * 3);
    const direction = new Float32Array(count * 3);
    const startTime = new Float32Array(count).fill(-999);
    const color = new Float32Array(count * 3);

    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('aIsEnd', new THREE.BufferAttribute(isEnd, 1));
    geo.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3));
    geo.setAttribute('aDirection', new THREE.BufferAttribute(direction, 3));
    geo.setAttribute('aStartTime', new THREE.BufferAttribute(startTime, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader: speedlineVert,
      fragmentShader: speedlineFrag,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.speedLines = new THREE.LineSegments(geo, mat);
    this.scene.add(this.speedLines);
  }

  _spawnSpeedLineBurst(position, colorHex, count = 14) {
    const geo = this.speedLines.geometry;
    const isEndAttr = geo.attributes.aIsEnd;
    const originAttr = geo.attributes.aOrigin;
    const dirAttr = geo.attributes.aDirection;
    const startAttr = geo.attributes.aStartTime;
    const colorAttr = geo.attributes.aColor;
    const rgb = hexToRgb(colorHex);

    for (let i = 0; i < count; i++) {
      const lineIdx = this._speedLineCursor;
      this._speedLineCursor = (this._speedLineCursor + 1) % MAX_SPEEDLINE_SEGMENTS;
      const v0 = lineIdx * 2, v1 = lineIdx * 2 + 1;
      const dir = randomOnSphere();

      for (const v of [v0, v1]) {
        originAttr.setXYZ(v, position.x, position.y, position.z);
        dirAttr.setXYZ(v, dir.x, dir.y, dir.z);
        startAttr.setX(v, this.clock.time);
        colorAttr.setXYZ(v, rgb.r, rgb.g, rgb.b);
      }
      isEndAttr.setX(v0, 0);
      isEndAttr.setX(v1, 1);
    }

    originAttr.needsUpdate = true;
    dirAttr.needsUpdate = true;
    startAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    isEndAttr.needsUpdate = true;
  }

  update(dt) {
    this.clock.time += dt;
    this.burstPoints.material.uniforms.uTime.value = this.clock.time;
    this.trailPoints.material.uniforms.uTime.value = this.clock.time;
    this.speedLines.material.uniforms.uTime.value = this.clock.time;

    const posAttr = this.trailPoints.geometry.attributes.position;
    const linePosAttr = this.trailLines.geometry.attributes.position;
    const lineColorAttr = this.trailLines.geometry.attributes.color;

    for (const [id, trail] of this._activeTrails) {
      const age = this.clock.time - trail.spawnTime;
      const totalLifetime = trail.travelTime + FADE_TAIL;
      if (age > totalLifetime) {
        this._activeTrails.delete(id);
        continue;
      }

      const t = Math.min(1, age / trail.travelTime);
      const lerped = {
        x: lerp(trail.from.x, trail.to.x, t),
        y: lerp(trail.from.y, trail.to.y, t),
        z: lerp(trail.from.z, trail.to.z, t),
      };
      const curl = this.curl.sample(lerped, this.clock.time);
      const pos = { x: lerped.x + curl.x, y: lerped.y + curl.y, z: lerped.z + curl.z };

      posAttr.setXYZ(trail.index, pos.x, pos.y, pos.z);

      const fadeT = age <= trail.travelTime ? 1 : Math.max(0, 1 - (age - trail.travelTime) / FADE_TAIL);
      const [r, g, b] = trail.colorArr;
      linePosAttr.setXYZ(trail.index * 2, trail.prevPos.x, trail.prevPos.y, trail.prevPos.z);
      linePosAttr.setXYZ(trail.index * 2 + 1, pos.x, pos.y, pos.z);
      lineColorAttr.setXYZ(trail.index * 2, r * fadeT, g * fadeT, b * fadeT);
      lineColorAttr.setXYZ(trail.index * 2 + 1, r * fadeT, g * fadeT, b * fadeT);

      trail.prevPos = pos;
    }

    posAttr.needsUpdate = true;
    linePosAttr.needsUpdate = true;
    lineColorAttr.needsUpdate = true;
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

function hexToRgb(hex) {
  return { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}