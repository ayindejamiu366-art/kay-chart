// Real-music-style audio generator.
// Produces a playable WAV with chord progressions + a melody line,
// so fallback playback sounds like actual music (not beeps).
// Entirely self-contained (pure Node), deterministic per track.

// A set of musical key centers (root freq * 2^(i/12)) so we get pleasant chromatic variety.
const SEMITONE = Math.pow(2, 1 / 12);

// Common chord progressions in semitones from a root. Each is a list of [semi, type]
// where type controls the chord quality. We build triads.
const PROGRESSIONS = [
  // I - V - vi - IV style patterns (relative to root)
  [0, -2, 4],        // minor
  [-2, 4, 0],        // variations
  [4, 0, -2],
  [0, 3, 7],         // major
  [3, 7, 0],
];

function hashSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic PRNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate a short musical piece. durationSec ~ 10-12s.
function generateWav(seed, durationSec = 12) {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const rand = mulberry32(hashSeed(seed || 'nocturne'));

  // Pick a root note around A3-C4 (220-262 Hz) for warmth
  const rootSemi = -3 + Math.floor(rand() * 13); // A2..G#3
  const rootFreq = 110 * Math.pow(SEMITONE, rootSemi);

  // Choose a key: minor or major-ish
  const isMinor = rand() > 0.5;

  // Build a 4-chord progression from scale degrees
  // scale = [root, 2, b3, 4, 5, b6, b7] minor or [root,2,3,4,5,6,7] major
  const scaleSemi = isMinor
    ? [0, 2, 3, 5, 7, 8, 10]
    : [0, 2, 4, 5, 7, 9, 11];

  // Pick 4 chords
  const degrees = [0, 3, 4, 5, 1, 4, 0, 5];
  const barCount = 8;
  const secondsPerBar = durationSec / barCount;

  // per-chord: base frequency array (root+third+fifth) + bass
  const chords = [];
  for (let b = 0; b < barCount; b++) {
    const deg = degrees[b % degrees.length];
    const chordRoot = Math.pow(SEMITONE, scaleSemi[deg % scaleSemi.length]);
    // triad: root, third (3 or 4 semitones), fifth (7)
    const thirdSemi = isMinor ? 3 : 4;
    const fifthSemi = 7;
    chords.push({
      base: rootFreq * chordRoot,
      freqs: [
        rootFreq * Math.pow(SEMITONE, scaleSemi[deg % scaleSemi.length] + 0),
        rootFreq * Math.pow(SEMITONE, scaleSemi[deg % scaleSemi.length] + thirdSemi),
        rootFreq * Math.pow(SEMITONE, scaleSemi[deg % scaleSemi.length] + fifthSemi),
        rootFreq * Math.pow(SEMITONE, scaleSemi[deg % scaleSemi.length] + (isMinor ? 10 : 11)), // 7th
      ],
    });
  }

  // Melody: a pentatonic-ish sequence using chord tones
  const melodyNotes = [];
  for (let b = 0; b < barCount; b++) {
    const chord = chords[b];
    const notesPerBar = 4;
    for (let n = 0; n < notesPerBar; n++) {
      // choose a chord tone (root/third/fifth) or octave up
      const tones = [
        chord.freqs[0], chord.freqs[1], chord.freqs[2],
        chord.freqs[0] * 2, chord.freqs[1] * 2,
        chord.freqs[2] * 2,
      ];
      const freq = tones[Math.floor(rand() * tones.length)];
      const start = b * secondsPerBar + (n / notesPerBar) * secondsPerBar * 0.9;
      const dur = secondsPerBar / notesPerBar * (0.7 + rand() * 0.2);
      melodyNotes.push({ freq, start, dur, amp: 0.3 });
    }
  }

  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Render
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Pad / chord (soft, sustained) - use a warm saw+filter sweep
    const barIndex = Math.min(barCount - 1, Math.floor(t / secondsPerBar));
    const chord = chords[barIndex];
    let chordVal = 0;
    for (const f of chord.freqs) {
      // sine with slight detune + harmonics for warmth
      chordVal += Math.sin(2 * Math.PI * f * t) * 0.5;
      chordVal += Math.sin(2 * Math.PI * f * t * 2) * 0.12;
    }
    chordVal *= 0.6 / chord.freqs.length;

    // Bass note (one octave down from chord root) - sine
    const bassFreq = chord.base / 2;
    let bassVal = Math.sin(2 * Math.PI * bassFreq * t) * 0.35;

    // Melody (bell-like envelope)
    let melodyVal = 0;
    for (let n = 0; n < melodyNotes.length; n++) {
      const m = melodyNotes[n];
      if (t >= m.start && t < m.start + m.dur) {
        const rel = (t - m.start) / m.dur;
        const env = Math.exp(-rel * 6) * (1 - rel); // decaying pluck
        // bell timbre: fundamental + harmonics
        melodyVal += Math.sin(2 * Math.PI * m.freq * t) * env * m.amp;
        melodyVal += Math.sin(2 * Math.PI * m.freq * 2 * t) * env * m.amp * 0.4;
        melodyVal += Math.sin(2 * Math.PI * m.freq * 3 * t) * env * m.amp * 0.2;
      }
    }

    // Combine, normalize, trim
    let val = (chordVal + bassVal + melodyVal) * 0.9;

    // global fade in/out
    let env = 1;
    if (t < 0.15) env = t / 0.15;
    if (t > durationSec - 0.5) env = Math.max(0, (durationSec - t) / 0.5);
    val *= env;

    val = Math.max(-1, Math.min(1, val));
    buffer.writeInt16LE(Math.round(val * 30000), 44 + i * bytesPerSample);
  }

  return buffer;
}

const cache = new Map();
function getAudioBuffer(id, name, durationSec = 12) {
  const seed = String(id || name || 'nocturne');
  if (cache.has(seed)) return cache.get(seed);
  const buf = generateWav(seed, durationSec);
  cache.set(seed, buf);
  return buf;
}

module.exports = { generateWav, getAudioBuffer };
