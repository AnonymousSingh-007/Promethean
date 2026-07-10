import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Connections between landmark indices, used only for drawing the debug skeleton.
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],           // thumb
  [0,5],[5,6],[6,7],[7,8],           // index
  [5,9],[9,10],[10,11],[11,12],      // middle
  [9,13],[13,14],[14,15],[15,16],    // ring
  [13,17],[17,18],[18,19],[19,20],   // pinky
  [0,17],                             // palm base
];

export class HandTracker {
  constructor(videoEl, debugCanvas = null) {
    this.videoEl = videoEl;
    this.debugCanvas = debugCanvas;
    this.debugCtx = debugCanvas ? debugCanvas.getContext('2d') : null;
    this.landmarker = null;
    this.running = false;
    this._onResults = null;
    this._lastVideoTime = -1;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    // Try GPU delegate first, fall back to CPU — GPU delegate silently fails
    // on some laptops/drivers and leaves you with a tracker that never detects anything.
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      console.info('[Promethean] HandLandmarker ready (GPU delegate).');
    } catch (gpuErr) {
      console.warn('[Promethean] GPU delegate failed, falling back to CPU.', gpuErr);
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      console.info('[Promethean] HandLandmarker ready (CPU delegate).');
    }
  }

  async startWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    this.videoEl.srcObject = stream;
    await new Promise((resolve, reject) => {
      this.videoEl.onloadedmetadata = () => resolve();
      setTimeout(() => reject(new Error('Webcam metadata timed out')), 8000);
    });
    await this.videoEl.play();
    this.running = true;
    console.info('[Promethean] Webcam started:', this.videoEl.videoWidth, 'x', this.videoEl.videoHeight);
  }

  onResults(cb) {
    this._onResults = cb;
  }

  /** Call once per animation frame. No-ops until init() + startWebcam() have resolved. */
  tick() {
    if (!this.running || !this.landmarker) return;
    if (this.videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return; // video not actually delivering frames yet
    if (this.videoEl.currentTime === this._lastVideoTime) return;
    this._lastVideoTime = this.videoEl.currentTime;

    const result = this.landmarker.detectForVideo(this.videoEl, performance.now());
    const landmarks = result.landmarks ?? [];

    if (this.debugCtx) this._drawDebug(landmarks);

    if (this._onResults) {
      this._onResults({ landmarks, handedness: result.handednesses ?? [] });
    }
  }

  _drawDebug(landmarksList) {
    const ctx = this.debugCtx;
    const w = this.debugCanvas.width, h = this.debugCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (landmarksList.length === 0) {
      ctx.fillStyle = '#ff5c5c';
      ctx.font = '14px monospace';
      ctx.fillText('NO HAND DETECTED', 10, 20);
      return;
    }

    ctx.fillStyle = '#5cff8f';
    ctx.font = '14px monospace';
    ctx.fillText('HAND DETECTED', 10, 20);

    for (const hand of landmarksList) {
      // points are mirrored (selfie view) to match the CSS-mirrored video element
      const pts = hand.map(p => ({ x: (1 - p.x) * w, y: p.y * h }));

      ctx.strokeStyle = '#6cf7ff';
      ctx.lineWidth = 2;
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.stroke();
      }

      ctx.fillStyle = '#ffd76c';
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}