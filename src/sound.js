// Tiny procedural WebAudio SFX -- no samples, everything is synthesized on
// the fly to keep byte cost near zero. AudioContext is created lazily on
// the first sound (always triggered from a user gesture: pointerdown/tap).
let ac;
function audioCtx() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  return ac;
}

// One oscillator with a short exponential-decay envelope.
function tone(freq, dur, type, vol, freqEnd) {
  const a = audioCtx();
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain); gain.connect(a.destination);
  osc.start(t0); osc.stop(t0 + dur);
}

export function sfxAim() { tone(320, 0.1, 'triangle', 0.15, 460); }
export function sfxFlap() { tone(500, 0.12, 'square', 0.12, 780); }
export function sfxHit() { tone(660, 0.18, 'sine', 0.2, 990); }
export function sfxLevelUp() {
  tone(523, 0.14, 'sine', 0.22, 659);
  setTimeout(() => tone(784, 0.22, 'sine', 0.22, 1046), 110);
}
export function sfxMiss() { tone(300, 0.3, 'sawtooth', 0.15, 90); }
