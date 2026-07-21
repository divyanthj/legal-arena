const fs = require("node:fs");
const path = require("node:path");

const sampleRate = 48000;
const seconds = 24;
const channels = 2;
const samples = sampleRate * seconds;
const pcm = Buffer.alloc(samples * channels * 2);
const tempo = 128;
const beatDuration = 60 / tempo;

let seed = 0x29a14f3;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff * 2 - 1;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
};

const chords = [
  [73.42, 110, 146.83, 174.61],
  [58.27, 87.31, 116.54, 146.83],
  [87.31, 130.81, 174.61, 220],
  [65.41, 98, 130.81, 196],
];

const impacts = [0, 1.5, 3.3, 5.3, 7.3, 9.7, 11.7, 13.7, 15.7, 17.7, 19.7, 21.6];

for (let i = 0; i < samples; i += 1) {
  const t = i / sampleRate;
  const beat = t / beatDuration;
  const beatPhase = beat % 1;
  const eighthPhase = (beat * 2) % 1;
  const beatIndex = Math.floor(beat) % 4;
  const section = Math.floor(t / 4) % chords.length;
  const chord = chords[section];
  const storyDrop = t > 13.55 && t < 14.35 ? 0.22 : 1;

  let pad = 0;
  for (let note = 0; note < chord.length; note += 1) {
    const frequency = chord[note];
    pad += Math.sin(Math.PI * 2 * frequency * t + note * .57) * (.026 - note * .003);
    pad += Math.sin(Math.PI * 2 * frequency * 2.003 * t) * .0055;
  }
  pad *= .78 + Math.sin(Math.PI * 2 * .115 * t) * .18;

  const bassFrequency = chord[0] / 2;
  const bassEnvelope = Math.exp(-beatPhase * 4.8);
  const bass = Math.sin(Math.PI * 2 * bassFrequency * t) * bassEnvelope * .18;

  const kickEnvelope = Math.exp(-beatPhase * 19);
  const kickFrequency = 48 + 72 * Math.exp(-beatPhase * 29);
  const kick = Math.sin(Math.PI * 2 * kickFrequency * t) * kickEnvelope * .48;

  const snarePhase = beatPhase;
  const snareGate = beatIndex === 1 || beatIndex === 3 ? 1 : 0;
  const snare = noise() * Math.exp(-snarePhase * 27) * snareGate * .145;

  const hat = noise() * Math.exp(-eighthPhase * 43) * .052;

  let impact = 0;
  for (const hit of impacts) {
    const distance = t - hit;
    if (distance >= 0 && distance < .34) {
      impact += Math.sin(Math.PI * 2 * (75 - distance * 95) * distance) * Math.exp(-distance * 12) * .29;
      impact += noise() * Math.exp(-distance * 18) * .085;
    }
  }

  const riserStart = 19.15;
  const riser = t > riserStart && t < 19.72
    ? noise() * smooth((t - riserStart) / .57) * .11
    : 0;

  const intro = smooth(t / .45);
  const outro = 1 - smooth((t - 23.05) / .9);
  const master = intro * outro;
  const music = (pad + (bass + kick + snare + hat) * storyDrop + impact + riser) * master;
  const left = Math.tanh(music * 1.12);
  const right = Math.tanh((pad * .96 + (bass + kick) * storyDrop + snare * 1.06 + hat * .83 + impact * .92 - riser * .25) * master * 1.12);

  pcm.writeInt16LE(Math.round(left * 32767), i * 4);
  pcm.writeInt16LE(Math.round(right * 32767), i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
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
header.writeUInt32LE(pcm.length, 40);

const output = path.resolve(__dirname, "..", "public", "media", "legal-arena-promo-v2-beat.wav");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([header, pcm]));
console.log(`Generated ${output}`);
