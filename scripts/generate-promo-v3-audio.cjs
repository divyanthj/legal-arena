const fs = require("node:fs");
const path = require("node:path");

const sampleRate = 48000;
const seconds = 21;
const channels = 2;
const sampleCount = sampleRate * seconds;
const pcm = Buffer.alloc(sampleCount * channels * 2);

let seed = 0x3da9157;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff * 2 - 1;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
};

const typingStart = 62 / 30;
const typingEnd = 210 / 30;
const questionLength = 59;
const keyInterval = (typingEnd - typingStart) / questionLength;
const thinkingPulses = [8.5, 9.15, 9.8, 10.45, 11.1, 11.75, 12.4, 13.05];

for (let i = 0; i < sampleCount; i += 1) {
  const t = i / sampleRate;
  const fadeIn = smooth(t / .65);
  const fadeOut = 1 - smooth((t - 20.1) / .8);

  const pad = (
    Math.sin(Math.PI * 2 * 55 * t) * .035 +
    Math.sin(Math.PI * 2 * 82.41 * t + .6) * .022 +
    Math.sin(Math.PI * 2 * 110 * t + 1.2) * .013 +
    Math.sin(Math.PI * 2 * .095 * t) * .009
  ) * fadeIn * fadeOut;

  let keys = 0;
  if (t >= typingStart && t <= typingEnd + .08) {
    const keyPhase = (t - typingStart) % keyInterval;
    if (keyPhase < .026) {
      const envelope = Math.exp(-keyPhase * 115);
      keys = (noise() * .038 + Math.sin(Math.PI * 2 * 1650 * t) * .018) * envelope;
    }
  }

  let tap = 0;
  const tapDistance = t - 7.2;
  if (tapDistance >= 0 && tapDistance < .32) {
    tap = Math.sin(Math.PI * 2 * (92 - tapDistance * 90) * tapDistance) * Math.exp(-tapDistance * 13) * .3;
    tap += noise() * Math.exp(-tapDistance * 26) * .07;
  }

  let thinking = 0;
  for (const pulse of thinkingPulses) {
    const distance = t - pulse;
    if (distance >= 0 && distance < .55) {
      thinking += Math.sin(Math.PI * 2 * 270 * distance) * Math.exp(-distance * 7) * .036;
      thinking += Math.sin(Math.PI * 2 * 405 * distance) * Math.exp(-distance * 8) * .018;
    }
  }

  let answer = 0;
  const answerDistance = t - 13.5;
  if (answerDistance >= 0 && answerDistance < 1.35) {
    const rise = Math.exp(-answerDistance * 2.6);
    answer = (
      Math.sin(Math.PI * 2 * 293.66 * answerDistance) * .08 +
      Math.sin(Math.PI * 2 * 440 * answerDistance) * .065 +
      Math.sin(Math.PI * 2 * 587.33 * answerDistance) * .045
    ) * rise;
  }

  let cta = 0;
  if (t >= 17) {
    const local = t - 17;
    const beatPhase = (local * 2) % 1;
    const kick = Math.sin(Math.PI * 2 * (52 + 45 * Math.exp(-beatPhase * 25)) * local) * Math.exp(-beatPhase * 18) * .18;
    const shimmer = (
      Math.sin(Math.PI * 2 * 146.83 * local) * .035 +
      Math.sin(Math.PI * 2 * 220 * local) * .026 +
      Math.sin(Math.PI * 2 * 293.66 * local) * .018
    ) * smooth(local / .8);
    cta = kick + shimmer;
  }

  const master = (pad + keys + tap + thinking + answer + cta) * .95;
  const left = Math.tanh(master * 1.18);
  const right = Math.tanh((pad * .97 + keys * .82 + tap + thinking * 1.08 + answer * .94 + cta) * 1.18);

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

const output = path.resolve(__dirname, "..", "public", "media", "legal-arena-promo-v3-sound.wav");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([header, pcm]));
console.log(`Generated ${output}`);
