import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 3x3 grid, spaced generously so the neighbor graph (radius 3.5) never lets
// a cascade cross between isotopes even though only one cluster renders at once.
const CLUSTER_LAYOUT = {
  U235:  { x: -14, y:  9, z: 0 },
  Th232: { x:   0, y:  9, z: 0 },
  Pu239: { x:  14, y:  9, z: 0 },
  U238:  { x: -14, y:  0, z: 0 },
  Cf252: { x:   0, y:  0, z: 0 },
  Pu241: { x:  14, y:  0, z: 0 },
  U233:  { x: -14, y: -9, z: 0 },
  Np237: { x:   0, y: -9, z: 0 },
  Am241: { x:  14, y: -9, z: 0 },
};

const CAMERA_LERP = 0.06;

const COOL_BG = new THREE.Color(0x05050a);
const HOT_BG = new THREE.Color(0x2a0f08);
const COOL_FOG = new THREE.Color(0x05050a);
const HOT_FOG = new THREE.Color(0x3a1206);

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = COOL_BG.clone();
    this.scene.fog = new THREE.FogExp2(COOL_FOG.getHex(), 0.012);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(-17, 11, 9);
    this._camTargetPos = this.camera.position.clone();
    this._camLookAt = new THREE.Vector3(-14, 9, 0);
    this._camTargetLookAt = this._camLookAt.clone();
    this.camera.lookAt(this._camLookAt);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene.add(new THREE.AmbientLight(0x404060, 1.0));
    const key = new THREE.PointLight(0xffffff, 2, 120);
    key.position.set(5, 10, 15);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x6cf7ff, 1.2, 100);
    rim.position.set(-10, -8, -6);
    this.scene.add(rim);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.9, 0.6, 0.15
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.atomMeshes = new Map();
    this.atomVisuals = new Map();
    this.activeIsotopeId = null;
    this._baseBloomStrength = 0.9;

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.bloomPass.setSize(window.innerWidth, window.innerHeight);
  }

  buildAtomCluster(chainReaction, isotopeId, count, { radius = 3.2, color = 0x7cfc9c } = {}) {
    const center = CLUSTER_LAYOUT[isotopeId] ?? { x: 0, y: 0, z: 0 };
    const results = [];
    const nucleusGeo = new THREE.IcosahedronGeometry(0.16, 2);
    const ringGeo = new THREE.TorusGeometry(0.34, 0.006, 8, 48);

    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const jitter = 0.14;
      const localPos = new THREE.Vector3(
        Math.cos(theta) * r * radius + rand(-jitter, jitter),
        y * radius + rand(-jitter, jitter),
        Math.sin(theta) * r * radius + rand(-jitter, jitter)
      );
      const worldPos = localPos.clone().add(new THREE.Vector3(center.x, center.y, center.z));

      const atom = chainReaction.addAtom({ x: worldPos.x, y: worldPos.y, z: worldPos.z }, isotopeId);

      const group = new THREE.Group();
      group.position.copy(worldPos);
      group.visible = false;

      const nucleusMat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.35,
      });
      const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
      nucleus.userData.atomId = atom.id;
      group.add(nucleus);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.55 });
      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      ring1.rotation.set(rand(0.3, 0.9), rand(0, Math.PI), 0);
      const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
      ring2.rotation.set(rand(-0.9, -0.3), rand(0, Math.PI), 0);
      group.add(ring1, ring2);

      this.scene.add(group);
      this.atomMeshes.set(atom.id, nucleus);
      this.atomVisuals.set(atom.id, {
        group, nucleus, ring1, ring2, isotopeId,
        alive: true,
        active: false,
        phase: Math.random() * Math.PI * 2,
        spinSpeed1: rand(0.4, 0.9) * (Math.random() < 0.5 ? 1 : -1),
        spinSpeed2: rand(0.3, 0.7) * (Math.random() < 0.5 ? 1 : -1),
      });

      results.push({ atom, group, nucleus });
    }
    return results;
  }

  setActiveIsotope(isotopeId, { revive = true } = {}) {
    this.activeIsotopeId = isotopeId;
    for (const visual of this.atomVisuals.values()) {
      if (visual.isotopeId === isotopeId && revive) visual.alive = true;
      visual.active = visual.isotopeId === isotopeId;
      visual.group.visible = visual.active && visual.alive;
    }

    const center = CLUSTER_LAYOUT[isotopeId] ?? { x: 0, y: 0, z: 0 };
    this._camTargetLookAt.set(center.x, center.y, center.z);
    this._camTargetPos.set(center.x - 3, center.y + 2, center.z + 9);
  }

  setHeat(heat) {
    const bg = COOL_BG.clone().lerp(HOT_BG, heat);
    this.scene.background = bg;
    this.scene.fog.color.copy(COOL_FOG).lerp(HOT_FOG, heat);
    this.bloomPass.strength = this._baseBloomStrength + heat * 0.5;
  }

  updateAtoms(dt, elapsedTime) {
    this.camera.position.lerp(this._camTargetPos, CAMERA_LERP);
    this._camLookAt.lerp(this._camTargetLookAt, CAMERA_LERP);
    this.camera.lookAt(this._camLookAt);

    for (const v of this.atomVisuals.values()) {
      if (!v.group.visible) continue;
      v.ring1.rotation.z += dt * v.spinSpeed1;
      v.ring2.rotation.z += dt * v.spinSpeed2;
      v.nucleus.material.emissiveIntensity = 0.55 + Math.sin(elapsedTime * 2 + v.phase) * 0.18;
      v.nucleus.scale.setScalar(1 + Math.sin(elapsedTime * 1.5 + v.phase) * 0.03);
    }
  }

  raycastAtom(ndcX, ndcY) {
    if (!this._raycaster) this._raycaster = new THREE.Raycaster();
    this._raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const meshes = [...this.atomMeshes.values()].filter(m => m.visible);
    const hits = this._raycaster.intersectObjects(meshes);
    return hits.length ? hits[0].object.userData.atomId : null;
  }

  screenToWorldPoint(ndcX, ndcY, distance = 14) {
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(this.camera);
    const dir = vector.sub(this.camera.position).normalize();
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  killAtomVisual(atomId) {
    const visual = this.atomVisuals.get(atomId);
    if (!visual) return;
    visual.alive = false;
    visual.group.visible = visual.active && visual.alive;
  }

  render() {
    this.composer.render();
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}