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

/** intensity: neutron count for this clap (5/20/50) — scales pitch drop and loudness so a HIGH clap audibly hits harder. */
export function playClapTone(intensity = 20) {
  const c = getContext();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  const scale = Math.min(1, intensity / 50);
  osc.frequency.setValueAtTime(180 - scale * 60, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, c.currentTime + 0.25 + scale * 0.15);
  const peakGain = 0.2 + scale * 0.25;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35 + scale * 0.15);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.55);
}