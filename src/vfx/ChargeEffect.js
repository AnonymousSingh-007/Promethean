import * as THREE from 'three';

const COOL_COLOR = new THREE.Color(0x6cf7ff);
const HOT_COLOR = new THREE.Color(0xff5c3c);
const TIER_BURST_SCALE = { LOW: 0.5, MED: 1.0, HIGH: 1.6, ULTRA: 2.4 };
const RELEASE_DURATION = 0.22;

export class ChargeEffect {
  constructor(scene) {
    const geo = new THREE.SphereGeometry(0.35, 24, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: COOL_COLOR, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    scene.add(this.mesh);

    this._targetActive = false;
    this._targetProgress = 0;
    this._targetPos = new THREE.Vector3();
    this._releaseTimer = 0;
    this._releaseTier = null;
  }

  setCharging(worldPos, progress) {
    this._targetActive = true;
    this._targetProgress = progress;
    this._targetPos.set(worldPos.x, worldPos.y, worldPos.z);
    this.mesh.visible = true;
  }

  cancel() {
    this._targetActive = false;
    this._targetProgress = 0;
  }

  release(tier) {
    this._targetActive = false;
    this._releaseTimer = RELEASE_DURATION;
    this._releaseTier = tier;
  }

  updateFrame(dt) {
    const now = performance.now() / 1000;

    if (this._releaseTimer > 0) {
      this._releaseTimer = Math.max(0, this._releaseTimer - dt);
      const t = 1 - this._releaseTimer / RELEASE_DURATION;
      const burstScale = TIER_BURST_SCALE[this._releaseTier] ?? 1;
      this.mesh.scale.setScalar((0.4 + t * 1.6) * burstScale);
      this.mesh.material.opacity = (1 - t) * 0.9;
      if (this._releaseTimer <= 0) this.mesh.visible = false;
      return;
    }

    if (!this._targetActive) {
      this.mesh.material.opacity = Math.max(0, this.mesh.material.opacity - dt * 3);
      if (this.mesh.material.opacity <= 0) this.mesh.visible = false;
      return;
    }

    this.mesh.position.lerp(this._targetPos, 0.5);
    const pulse = 1 + Math.sin(now * (8 + this._targetProgress * 18)) * 0.08;
    this.mesh.scale.setScalar((0.3 + this._targetProgress * 0.9) * pulse);
    this.mesh.material.color.copy(COOL_COLOR).lerp(HOT_COLOR, this._targetProgress);
    this.mesh.material.opacity = 0.25 + this._targetProgress * 0.55;
  }
}