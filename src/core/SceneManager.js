import * as THREE from 'three';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050a);
    this.scene.fog = new THREE.FogExp2(0x05050a, 0.012);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 4, 18);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene.add(new THREE.AmbientLight(0x404060, 1.0));
    const key = new THREE.PointLight(0xffffff, 2, 100);
    key.position.set(5, 10, 10);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x6cf7ff, 1.2, 80);
    rim.position.set(-8, -6, -6);
    this.scene.add(rim);

    this.atomMeshes = new Map();   // atomId -> nucleus THREE.Mesh (used for raycasting + kill)
    this.atomVisuals = new Map();  // atomId -> { group, nucleus, ring1, ring2, phase, baseEmissive }

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Lays out `count` atoms in a jittered fibonacci-sphere cluster. Each atom is
   * a small "Bohr model" — glowing icosahedral nucleus plus two tilted electron
   * rings — rather than a flat sphere, so the cluster reads as scientific rather
   * than decorative. Ring rotation + nucleus pulse are animated in updateAtoms().
   */
  buildAtomCluster(chainReaction, isotopeId, count, { radius = 6, color = 0x7cfc9c } = {}) {
    const results = [];
    const nucleusGeo = new THREE.IcosahedronGeometry(0.16, 2);
    const ringGeo = new THREE.TorusGeometry(0.34, 0.006, 8, 48);

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

      const group = new THREE.Group();
      group.position.copy(pos);

      const nucleusMat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.35,
      });
      const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
      nucleus.userData.atomId = atom.id;
      group.add(nucleus);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x9fd6ff, transparent: true, opacity: 0.55,
      });
      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      ring1.rotation.x = rand(0.3, 0.9);
      ring1.rotation.y = rand(0, Math.PI);
      const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
      ring2.rotation.x = rand(-0.9, -0.3);
      ring2.rotation.y = rand(0, Math.PI);
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

  /** Call once per frame to animate electron-ring orbits and nucleus pulsing. */
  updateAtoms(dt, elapsedTime) {
    for (const v of this.atomVisuals.values()) {
      if (!v.nucleus.visible) continue; // fissioned atoms are hidden, skip animating them
      v.ring1.rotation.z += dt * v.spinSpeed1;
      v.ring2.rotation.z += dt * v.spinSpeed2;
      const pulse = 0.5 + Math.sin(elapsedTime * 2 + v.phase) * 0.15;
      v.nucleus.material.emissiveIntensity = pulse;
      const scale = 1 + Math.sin(elapsedTime * 1.5 + v.phase) * 0.03;
      v.nucleus.scale.setScalar(scale);
    }
  }

  /** Raycast from normalized device coords to the nearest atom nucleus. */
  raycastAtom(ndcX, ndcY) {
    if (!this._raycaster) this._raycaster = new THREE.Raycaster();
    this._raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const meshes = [...this.atomMeshes.values()].filter(m => m.visible);
    const hits = this._raycaster.intersectObjects(meshes);
    return hits.length ? hits[0].object.userData.atomId : null;
  }

  /** Unprojects a screen-space NDC point into a 3D world position at a fixed distance from camera. */
  screenToWorldPoint(ndcX, ndcY, distance = 14) {
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(this.camera);
    const dir = vector.sub(this.camera.position).normalize();
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  killAtomVisual(atomId) {
    const visual = this.atomVisuals.get(atomId);
    if (visual) visual.group.visible = false; // hide the whole group (nucleus + rings), not just the nucleus
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}