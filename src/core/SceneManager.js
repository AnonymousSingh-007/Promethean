import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AtomField } from './AtomField.js';

const CLUSTER_LAYOUT = {
  U235:  { x: -18, y:  14, z: 0 },
  Th232: { x:   0, y:  14, z: 0 },
  Pu239: { x:  18, y:  14, z: 0 },
  U238:  { x: -18, y:   0, z: 0 },
  Cf252: { x:   0, y:   0, z: 0 },
  Pu241: { x:  18, y:   0, z: 0 },
  U233:  { x: -18, y: -14, z: 0 },
  Np237: { x:   0, y: -14, z: 0 },
  Am241: { x:  18, y: -14, z: 0 },
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
    this.scene.fog = new THREE.FogExp2(COOL_FOG.getHex(), 0.01);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 250);
    this.camera.position.set(-22, 17, 12);
    this._camTargetPos = this.camera.position.clone();
    this._camLookAt = new THREE.Vector3(-18, 14, 0);
    this._camTargetLookAt = this._camLookAt.clone();
    this.camera.lookAt(this._camLookAt);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene.add(new THREE.AmbientLight(0x404060, 1.0));
    const key = new THREE.PointLight(0xffffff, 2, 140);
    key.position.set(5, 10, 15);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x6cf7ff, 1.2, 120);
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

    this.atomFields = new Map();
    this.atomIndexByAtomId = new Map();
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

  buildAtomCluster(chainReaction, isotopeId, count, { radius = 4.2, color = 0x7cfc9c } = {}) {
    const center = CLUSTER_LAYOUT[isotopeId] ?? { x: 0, y: 0, z: 0 };
    const positions = [];
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
      this.atomIndexByAtomId.set(atom.id, { isotopeId, index: positions.length });
      positions.push(worldPos);
    }

    const field = new AtomField(this.scene, positions, color);
    this.atomFields.set(isotopeId, field);
    return positions;
  }

  setActiveIsotope(isotopeId, { revive = true } = {}) {
    this.activeIsotopeId = isotopeId;
    for (const [id, field] of this.atomFields) {
      field.setVisible(id === isotopeId);
    }
    if (revive) this.atomFields.get(isotopeId)?.reviveAll();

    const center = CLUSTER_LAYOUT[isotopeId] ?? { x: 0, y: 0, z: 0 };
    this._camTargetLookAt.set(center.x, center.y, center.z);
    this._camTargetPos.set(center.x - 4, center.y + 3, center.z + 12);
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

    for (const field of this.atomFields.values()) {
      field.updateTime(elapsedTime);
    }
  }

  screenToWorldPoint(ndcX, ndcY, distance = 14) {
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(this.camera);
    const dir = vector.sub(this.camera.position).normalize();
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  /**
   * The fix: places the neutron/charge-orb origin a fixed FRACTION of the
   * camera-to-cluster distance in front of the camera (15%), rather than a
   * hardcoded absolute distance. A hardcoded number (the old approach) broke
   * the moment the camera/cluster framing changed enough that the fixed
   * distance no longer stayed in front of the cluster — exactly what happened
   * here. This scales automatically with whatever the current camera framing is.
   */
  getHandOriginPoint(ndcX, ndcY) {
    const camToTarget = this.camera.position.distanceTo(this._camTargetLookAt);
    const distance = Math.max(1.5, camToTarget * 0.15);
    return this.screenToWorldPoint(ndcX, ndcY, distance);
  }

  killAtomVisual(atomId) {
    const ref = this.atomIndexByAtomId.get(atomId);
    if (!ref) return;
    this.atomFields.get(ref.isotopeId)?.setAliveAt(ref.index, false);
  }

  render() {
    this.composer.render();
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}