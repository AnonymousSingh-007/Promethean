import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

const HAND_COLORS = ['#6cf7ff', '#ffb86c']; // distinct color per hand slot in the debug overlay

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

    const options = {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2, // both hands — needed for finger-count selection + clap detection
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, options);
      console.info('[Promethean] HandLandmarker ready (GPU delegate).');
    } catch (gpuErr) {
      console.warn('[Promethean] GPU delegate failed, falling back to CPU.', gpuErr);
      options.baseOptions.delegate = 'CPU';
      this.landmarker = await HandLandmarker.createFromOptions(vision, options);
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

  tick() {
    if (!this.running || !this.landmarker) return;
    if (this.videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
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
      ctx.fillText('NO HANDS DETECTED', 10, 20);
      return;
    }

    ctx.fillStyle = '#5cff8f';
    ctx.font = '14px monospace';
    ctx.fillText(`${landmarksList.length} HAND${landmarksList.length > 1 ? 'S' : ''} DETECTED`, 10, 20);

    landmarksList.forEach((hand, handIdx) => {
      const color = HAND_COLORS[handIdx % HAND_COLORS.length];
      const pts = hand.map(p => ({ x: (1 - p.x) * w, y: p.y * h }));

      ctx.strokeStyle = color;
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
    });
  }
}