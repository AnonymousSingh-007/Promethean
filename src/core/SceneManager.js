import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Each isotope still lives at its own fixed spatial position — this matters
// for physics (ChainReaction's neighbor graph relies on spatial separation so
// cascades never jump isotopes) — but only ONE cluster is ever visible/rendered
// at a time. Switching isotope hides the old cluster, shows the new one, and
// smoothly moves the camera to frame it.
const CLUSTER_LAYOUT = {
  U235:  { x: -9, y:  4, z: 0 },
  Th232: { x:  9, y:  4, z: 0 },
  Pu239: { x: -9, y: -4, z: 0 },
  U238:  { x:  9, y: -4, z: 0 },
};

const CAMERA_LERP = 0.06; // per-frame lerp factor for camera focus transitions — lower = slower/smoother

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050a);
    this.scene.fog = new THREE.FogExp2(0x05050a, 0.012);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(-3, 6, 12);
    this._camTargetPos = this.camera.position.clone();
    this._camLookAt = new THREE.Vector3(-9, 4, 0); // defaults to U235's cluster center
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

    // --- Bloom post-processing pipeline ---
    // UnrealBloomPass makes the emissive nucleus materials and additive particle
    // bursts actually glow, instead of just being bright-colored and flat.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.9,   // strength
      0.6,   // radius
      0.15   // threshold — lower = more of the scene contributes to bloom
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass()); // correct color space/tone mapping after bloom

    this.atomMeshes = new Map();
    this.atomVisuals = new Map(); // atomId -> { group, nucleus, ring1, ring2, isotopeId, alive, active, phase, ... }
    this.activeIsotopeId = null;

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
      group.visible = false; // hidden until setActiveIsotope() reveals this isotope's cluster

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
        active: false, // whether this atom's isotope is the currently selected one
        phase: Math.random() * Math.PI * 2,
        spinSpeed1: rand(0.4, 0.9) * (Math.random() < 0.5 ? 1 : -1),
        spinSpeed2: rand(0.3, 0.7) * (Math.random() < 0.5 ? 1 : -1),
      });

      results.push({ atom, group, nucleus });
    }
    return results;
  }

  /**
   * Shows only this isotope's cluster (hides the other three) and smoothly
   * moves the camera to frame it. Call once at startup with the default
   * isotope, then again every time ISOTOPE_SELECTED fires.
   */
  setActiveIsotope(isotopeId) {
    this.activeIsotopeId = isotopeId;
    for (const visual of this.atomVisuals.values()) {
      visual.active = visual.isotopeId === isotopeId;
      visual.group.visible = visual.active && visual.alive;
    }

    const center = CLUSTER_LAYOUT[isotopeId] ?? { x: 0, y: 0, z: 0 };
    this._camTargetLookAt.set(center.x, center.y, center.z);
    this._camTargetPos.set(center.x - 3, center.y + 2, center.z + 9);
  }

  /** Call once per frame to smoothly move the camera toward the active cluster and animate ring/nucleus motion. */
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
    visual.group.visible = visual.active && visual.alive; // will now evaluate to false
  }

  render() {
    this.composer.render();
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}