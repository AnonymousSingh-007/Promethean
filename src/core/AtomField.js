import * as THREE from 'three';
import atomVert from '../vfx/shaders/atom.vert.glsl?raw';
import atomFrag from '../vfx/shaders/atom.frag.glsl?raw';
import ringVert from '../vfx/shaders/ring.vert.glsl?raw';
import ringFrag from '../vfx/shaders/ring.frag.glsl?raw';

// One AtomField per isotope: a single InstancedMesh for all nuclei plus one
// for all electron rings (2 per atom), instead of hundreds of individual
// THREE.Mesh/Group objects. Atom positions never change, so instance
// matrices are set ONCE at construction — per-frame cost is just a uniform
// update per field (O(isotope count), not O(atom count)). Pulsing, scale
// breathing, and ring spin all happen in the vertex shader driven by
// uTime + a per-instance phase/spin attribute, so animation costs nothing
// extra per frame either. This is what makes 80-atom clusters affordable
// where 30 individual-mesh atoms were already the practical ceiling.
export class AtomField {
  constructor(scene, positions, color) {
    this.count = positions.length;

    const nucleusGeo = new THREE.IcosahedronGeometry(0.16, 2);
    this._addInstanceAttributes(nucleusGeo, this.count);
    const nucleusMat = new THREE.ShaderMaterial({
      vertexShader: atomVert,
      fragmentShader: atomFrag,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } },
    });
    this.nucleusMesh = new THREE.InstancedMesh(nucleusGeo, nucleusMat, this.count);
    this.nucleusMesh.visible = false;

    const ringGeo = new THREE.TorusGeometry(0.34, 0.006, 8, 32);
    const ringCount = this.count * 2;
    this._addInstanceAttributes(ringGeo, ringCount, { spin: true });
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    this.ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, ringCount);
    this.ringMesh.visible = false;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const e = new THREE.Euler();

    for (let i = 0; i < this.count; i++) {
      const p = positions[i];
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q.identity(), s);
      this.nucleusMesh.setMatrixAt(i, m);

      for (let r = 0; r < 2; r++) {
        const ringIdx = i * 2 + r;
        e.set(rand(0.3, 0.9) * (r === 0 ? 1 : -1), rand(0, Math.PI), 0);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q, s);
        this.ringMesh.setMatrixAt(ringIdx, m);
      }
    }
    this.nucleusMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.instanceMatrix.needsUpdate = true;

    scene.add(this.nucleusMesh, this.ringMesh);
  }

  _addInstanceAttributes(geo, count, { spin = false } = {}) {
    const phase = new Float32Array(count);
    const alive = new Float32Array(count).fill(1);
    for (let i = 0; i < count; i++) phase[i] = Math.random() * Math.PI * 2;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    geo.setAttribute('aAlive', new THREE.InstancedBufferAttribute(alive, 1));
    if (spin) {
      const spinSpeed = new Float32Array(count);
      for (let i = 0; i < count; i++) spinSpeed[i] = rand(0.3, 0.9) * (Math.random() < 0.5 ? 1 : -1);
      geo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spinSpeed, 1));
    }
  }

  /** index is the atom's index within this field (0..count-1) — its ring pair is always 2*index, 2*index+1. */
  setAliveAt(index, alive) {
    const v = alive ? 1 : 0;
    this.nucleusMesh.geometry.attributes.aAlive.setX(index, v);
    this.nucleusMesh.geometry.attributes.aAlive.needsUpdate = true;
    this.ringMesh.geometry.attributes.aAlive.setX(index * 2, v);
    this.ringMesh.geometry.attributes.aAlive.setX(index * 2 + 1, v);
    this.ringMesh.geometry.attributes.aAlive.needsUpdate = true;
  }

  reviveAll() {
    const nAlive = this.nucleusMesh.geometry.attributes.aAlive;
    const rAlive = this.ringMesh.geometry.attributes.aAlive;
    for (let i = 0; i < this.count; i++) nAlive.setX(i, 1);
    for (let i = 0; i < this.count * 2; i++) rAlive.setX(i, 1);
    nAlive.needsUpdate = true;
    rAlive.needsUpdate = true;
  }

  setVisible(visible) {
    this.nucleusMesh.visible = visible;
    this.ringMesh.visible = visible;
  }

  updateTime(t) {
    this.nucleusMesh.material.uniforms.uTime.value = t;
    this.ringMesh.material.uniforms.uTime.value = t;
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}