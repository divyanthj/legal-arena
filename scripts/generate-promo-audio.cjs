const fs = require("node:fs");
const path = require("node:path");

const sampleRate = 44100;
const seconds = 20;
const channels = 2;
const frameCount = sampleRate * seconds;
const data = Buffer.alloc(frameCount * channels * 2);

let noiseState = 0x51f15e;
const noise = () => {
  noiseState = (noiseState * 1664525 + 1013904223) >>> 0;
  return (noiseState / 0xffffffff) * 2 - 1;
};

const chords = [
  [73.42, 110.0, 146.83, 174.61],
  [87.31, 130.81, 174.61, 220.0],
  [65.41, 98.0, 130.81, 164.81],
  [55.0, 82.41, 110.0, 146.83],
];

const smoothstep = (value) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};

for (let i = 0; i < frameCount; i += 1) {
  const t = i / sampleRate;
  const beat = t * 2;
  const beatPhase = beat % 1;
  const halfBeat = (t * 4) % 1;
  const chord = chords[Math.floor(t / 4) % chords.length];

  let pad = 0;
  for (let note = 0; note < chord.length; note += 1) {
    const frequency = chord[note];
    pad += Math.sin(Math.PI * 2 * frequency * t + note * 0.42) * (0.042 - note * 0.004);
    pad += Math.sin(Math.PI * 2 * frequency * 2 * t) * 0.008;
  }
  pad *= 0.78 + Math.sin(Math.PI * 2 * 0.125 * t) * 0.12;

  const kickEnvelope = Math.exp(-beatPhase * 18);
  const kickFrequency = 48 + 58 * Math.exp(-beatPhase * 30);
  const kick = Math.sin(Math.PI * 2 * kickFrequency * t) * kickEnvelope * 0.52;

  const hatEnvelope = Math.exp(-halfBeat * 40);
  const hat = noise() * hatEnvelope * 0.08;

  const clapPhase = (t * 2 + 0.5) % 1;
  const clapEnvelope = Math.exp(-clapPhase * 30);
  const clapGate = beatPhase > 0.47 && beatPhase < 0.74 ? 1 : 0;
  const clap = noise() * clapEnvelope * clapGate * 0.13;

  const transitionPhase = t % 4;
  const transition = transitionPhase > 3.72
    ? noise() * smoothstep((transitionPhase - 3.72) / 0.28) * 0.055
    : 0;

  const intro = smoothstep(t / 0.7);
  const outro = 1 - smoothstep((t - 18.9) / 1.0);
  const master = intro * outro;
  const left = (pad + kick + hat + clap + transition) * master;
  const right = (pad * 0.96 + kick + hat * 0.86 + clap * 1.05 - transition * 0.35) * master;

  const leftSample = Math.max(-1, Math.min(1, left));
  const rightSample = Math.max(-1, Math.min(1, right));
  data.writeInt16LE(Math.round(leftSample * 32767), i * 4);
  data.writeInt16LE(Math.round(rightSample * 32767), i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(channels, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * channels * 2, 28);
header.writeUInt16LE(channels * 2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

const output = path.resolve(__dirname, "..", "public", "media", "legal-arena-promo-beat.wav");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([header, data]));
console.log(`Generated ${output}`);
