// Minimal Web Audio beeps — no audio files, no dependencies. Browsers require
// a user gesture before audio can play; the first hand-tracking gesture that
// fires will implicitly unlock it (AudioContext auto-resumes on first call).

let ctx = null;
function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Short rising blip on isotope selection — pitch varies by finger count so each isotope has a distinct "voice". */
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

/** Low descending thump on clap/bombardment. */
export function playClapTone() {
  const c = getContext();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.25);
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.3);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.32);
}