import * as THREE from 'three';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050a);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 4, 18);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene.add(new THREE.AmbientLight(0x404060, 1.2));
    const key = new THREE.PointLight(0xffffff, 1.5, 100);
    key.position.set(5, 10, 10);
    this.scene.add(key);

    this.atomMeshes = new Map(); // atomId -> THREE.Mesh, so ChainReaction events can find their visual

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Lays out `count` atoms in a rough spherical lattice cluster and registers them
   * with the ChainReaction sim. Returns the list of {atom, mesh} for further wiring.
   * Kept simple on purpose — a jittered fibonacci sphere reads well visually and
   * gives a natural neighbor radius without manual placement.
   */
  buildAtomCluster(chainReaction, isotopeId, count, { radius = 6, color } = {}) {
    const results = [];
    const geo = new THREE.IcosahedronGeometry(0.18, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: color ?? 0x7cfc9c,
      emissive: color ?? 0x7cfc9c,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.1,
    });

    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const jitter = 0.15;
      const pos = new THREE.Vector3(
        Math.cos(theta) * r * radius + rand(-jitter, jitter),
        y * radius + rand(-jitter, jitter),
        Math.sin(theta) * r * radius + rand(-jitter, jitter)
      );

      const atom = chainReaction.addAtom({ x: pos.x, y: pos.y, z: pos.z }, isotopeId);
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.position.copy(pos);
      mesh.userData.atomId = atom.id;
      this.scene.add(mesh);
      this.atomMeshes.set(atom.id, mesh);

      results.push({ atom, mesh });
    }
    return results;
  }

  /** Raycast from normalized device coords (e.g. mapped from a hand-throw gesture) to the nearest atom mesh. */
  raycastAtom(ndcX, ndcY) {
    if (!this._raycaster) this._raycaster = new THREE.Raycaster();
    this._raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const meshes = [...this.atomMeshes.values()].filter(m => m.visible);
    const hits = this._raycaster.intersectObjects(meshes);
    return hits.length ? hits[0].object.userData.atomId : null;
  }

  killAtomVisual(atomId) {
    const mesh = this.atomMeshes.get(atomId);
    if (mesh) mesh.visible = false; // hide rather than dispose — cheap, and keeps indices stable
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}
