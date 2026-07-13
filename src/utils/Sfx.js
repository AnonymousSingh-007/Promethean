let ctx = null;
function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function playSelectTone(index = 0) {
  const c = getContext();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440 + index * 80, c.currentTime);
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.2);
}

/** intensity: neutron count for this shot (now up to 110 with ULTRA) — scales pitch drop and loudness. */
export function playClapTone(intensity = 25) {
  const c = getContext();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  const scale = Math.min(1, intensity / 110);
  osc.frequency.setValueAtTime(180 - scale * 70, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.25 + scale * 0.2);
  const peakGain = 0.2 + scale * 0.3;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4 + scale * 0.2);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.65);
}