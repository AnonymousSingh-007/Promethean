import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Thin wrapper around MediaPipe's HandLandmarker. Emits raw 21-point landmark
// sets per detected hand via an `onResults` callback — GestureController.js
// is responsible for turning these into semantic gestures (pinch, throw, etc).
// Keeping this file dumb-and-thin means you can swap in a different tracker
// later without touching gesture logic.

export class HandTracker {
  constructor(videoEl) {
    this.videoEl = videoEl;
    this.landmarker = null;
    this.running = false;
    this._onResults = null;
    this._lastVideoTime = -1;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1, // bump to 2 if you want dual-hand gestures (e.g. one hand selects, one throws)
    });
  }

  async startWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    this.videoEl.srcObject = stream;
    await new Promise(resolve => {
      this.videoEl.onloadedmetadata = () => resolve();
    });
    this.videoEl.play();
    this.running = true;
  }

  onResults(cb) {
    this._onResults = cb;
  }

  /** Call once per animation frame. No-ops until init() + startWebcam() have resolved. */
  tick() {
    if (!this.running || !this.landmarker) return;
    if (this.videoEl.currentTime === this._lastVideoTime) return; // no new frame yet
    this._lastVideoTime = this.videoEl.currentTime;

    const result = this.landmarker.detectForVideo(this.videoEl, performance.now());
    if (this._onResults) {
      this._onResults({
        landmarks: result.landmarks ?? [],      // array of hands, each an array of 21 {x,y,z} normalized points
        handedness: result.handednesses ?? [],
      });
    }
  }
}
