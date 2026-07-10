import * as THREE from 'three';

// Cluster layout: one pocket per isotope, spread out enough that neighborRadius
// (3.5 units, see ChainReaction) never lets a cascade jump between isotopes.
const CLUSTER_LAYOUT = {
  U235:  { x: -9, y:  4, z: 0 },
  Th232: { x:  9, y:  4, z: 0 },
  Pu239: { x: -9, y: -4, z: 0 },
  U238:  { x:  9, y: -4, z: 0 },
};

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050a);
    this.scene.fog = new THREE.FogExp2(0x05050a, 0.009);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 3, 28);
    this.camera.lookAt(0, 0, 0);

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

    this.atomMeshes = new Map();
    this.atomVisuals = new Map();
    this.clusterLabels = new Map(); // isotopeId -> DOM label element

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Places a cluster at this isotope's fixed layout position (see CLUSTER_LAYOUT).
   * Each atom is a small "Bohr model" — glowing nucleus + two tilted electron
   * rings — so the cluster reads as scientific rather than decorative.
   */
  buildAtomCluster(chainReaction, isotopeId, count, { radius = 3.2, color = 0x7cfc9c } = {}) {
    const center = CLUSTER_LAYOUT[isotopeId] ?? { x: 0, y: 0, z: 0 };
    const results = [];
    const nucleusGeo = new THREE.IcosahedronGeometry(0.14, 2);
    const ringGeo = new THREE.TorusGeometry(0.3, 0.005, 8, 48);

    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const jitter = 0.12;
      const localPos = new THREE.Vector3(
        Math.cos(theta) * r * radius + rand(-jitter, jitter),
        y * radius + rand(-jitter, jitter),
        Math.sin(theta) * r * radius + rand(-jitter, jitter)
      );
      const worldPos = localPos.clone().add(new THREE.Vector3(center.x, center.y, center.z));

      const atom = chainReaction.addAtom({ x: worldPos.x, y: worldPos.y, z: worldPos.z }, isotopeId);

      const group = new THREE.Group();
      group.position.copy(worldPos);

      const nucleusMat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.35,
      });
      const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
      nucleus.userData.atomId = atom.id;
      group.add(nucleus);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.5 });
      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      ring1.rotation.set(rand(0.3, 0.9), rand(0, Math.PI), 0);
      const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
      ring2.rotation.set(rand(-0.9, -0.3), rand(0, Math.PI), 0);
      group.add(ring1, ring2);

      this.scene.add(group);
      this.atomMeshes.set(atom.id, nucleus);
      this.atomVisuals.set(atom.id, {
        group, nucleus, ring1, ring2,
        phase: Math.random() * Math.PI * 2,
        spinSpeed1: rand(0.4, 0.9) * (Math.random() < 0.5 ? 1 : -1),
        spinSpeed2: rand(0.3, 0.7) * (Math.random() < 0.5 ? 1 : -1),
      });

      results.push({ atom, group, nucleus });
    }
    return results;
  }

  updateAtoms(dt, elapsedTime) {
    for (const v of this.atomVisuals.values()) {
      if (!v.nucleus.visible) continue;
      v.ring1.rotation.z += dt * v.spinSpeed1;
      v.ring2.rotation.z += dt * v.spinSpeed2;
      v.nucleus.material.emissiveIntensity = 0.5 + Math.sin(elapsedTime * 2 + v.phase) * 0.15;
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

  screenToWorldPoint(ndcX, ndcY, distance = 20) {
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(this.camera);
    const dir = vector.sub(this.camera.position).normalize();
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  killAtomVisual(atomId) {
    const visual = this.atomVisuals.get(atomId);
    if (visual) visual.group.visible = false;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}