const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
const ffmpeg = path.join(root, "node_modules", "@ffmpeg-installer", "win32-x64", "ffmpeg.exe");
const ffprobe = path.join(root, "node_modules", "@ffprobe-installer", "win32-x64", "ffprobe.exe");
const source = path.join(root, "reference media", "gameplay_raw.mp4");
const derived = path.join(root, "reference media", "derived");
const publicMedia = path.join(root, "public", "media");
const font = "C\\:/Windows/Fonts/arialbd.ttf";

fs.mkdirSync(derived, { recursive: true });
fs.mkdirSync(publicMedia, { recursive: true });

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed with code ${result.status}`);
  }
}

function quoteText(text) {
  return text.replace(/'/g, "\\'").replace(/:/g, "\\:");
}

function caption(text, from = 0, to = 99, y = 760, size = 64) {
  return `drawtext=fontfile='${font}':text='${quoteText(text)}':x=(w-text_w)/2:y=${y}:fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.68:boxborderw=30:enable='between(t,${from},${to})'`;
}

function clip({
  name,
  ss,
  duration,
  crop,
  text,
  textY = 760,
  textSize = 64,
  zoom = 0.16,
  focusX = 0.5,
  focusY = 0.5,
  extra = "",
}) {
  const out = path.join(derived, `${name}.mp4`);
  const frames = Math.max(1, Math.round(duration * 30));
  const filters = [
    crop,
    `zoompan=z='1+${zoom}*on/${frames}':x='(iw-iw/zoom)*${focusX}':y='(ih-ih/zoom)*${focusY}':d=1:s=1920x1080:fps=30`,
    "setsar=1",
    "eq=contrast=1.08:saturation=1.12:brightness=0.01",
    extra,
    caption(text, 0, duration + 0.2, textY, textSize),
  ].filter(Boolean).join(",");

  run(ffmpeg, [
    "-y",
    "-ss", ss,
    "-t", String(duration),
    "-i", source,
    "-vf", filters,
    "-an",
    "-r", "30",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "veryfast",
    "-crf", "19",
    out,
  ]);

  return out;
}

const clips = [
  clip({
    name: "dynamic_01_verdict_flash",
    ss: "00:11:14.7",
    duration: 1.25,
    crop: "crop=1700:956:390:306",
    text: "An AI lawyer game",
    textY: 70,
    textSize: 58,
    zoom: 0.18,
    focusX: 0.22,
    focusY: 0.6,
  }),
  clip({
    name: "dynamic_02_case",
    ss: "00:00:40.3",
    duration: 1.75,
    crop: "crop=2244:1262:137:0",
    text: "Open a legal dispute",
    zoom: 0.2,
    focusX: 0.18,
    focusY: 0.16,
  }),
  clip({
    name: "dynamic_03_question",
    ss: "00:01:03.8",
    duration: 1.7,
    crop: "crop=1900:1069:370:110",
    text: "Interview your AI client",
    zoom: 0.22,
    focusX: 0.43,
    focusY: 0.66,
  }),
  clip({
    name: "dynamic_04_fact_sheet",
    ss: "00:02:30.0",
    duration: 1.55,
    crop: "crop=1720:968:760:130",
    text: "Build your case",
    zoom: 0.2,
    focusX: 0.7,
    focusY: 0.32,
  }),
  clip({
    name: "dynamic_05_pressure",
    ss: "00:04:55.0",
    duration: 1.65,
    crop: "crop=1750:984:410:120",
    text: "Step into court",
    zoom: 0.24,
    focusX: 0.28,
    focusY: 0.13,
  }),
  clip({
    name: "dynamic_06_round",
    ss: "00:06:39.6",
    duration: 1.6,
    crop: "crop=1650:928:460:245",
    text: "Fight the other side",
    textSize: 56,
    zoom: 0.22,
    focusX: 0.46,
    focusY: 0.48,
  }),
  clip({
    name: "dynamic_07_law",
    ss: "00:08:34.6",
    duration: 1.65,
    crop: "crop=1780:1001:525:190",
    text: "Use facts to win",
    zoom: 0.22,
    focusX: 0.42,
    focusY: 0.56,
  }),
  clip({
    name: "dynamic_08_submit",
    ss: "00:11:09.5",
    duration: 1.55,
    crop: "crop=1680:945:430:215",
    text: "Make your argument",
    zoom: 0.18,
    focusX: 0.85,
    focusY: 0.73,
  }),
  clip({
    name: "dynamic_09_green_verdict",
    ss: "00:11:15.0",
    duration: 3.05,
    crop: "crop=1700:956:392:306",
    text: "Get the verdict",
    textY: 72,
    textSize: 74,
    zoom: 0.25,
    focusX: 0.2,
    focusY: 0.36,
    extra: "fade=t=out:st=2.65:d=0.4",
  }),
];

const listPath = path.join(derived, "dynamic_concat_list.txt");
fs.writeFileSync(listPath, clips.map((file) => `file '${file.replace(/\\/g, "/")}'`).join("\n"));

const rawCut = path.join(derived, "gameplay_showcase_dynamic_rawcut.mp4");
run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", rawCut]);

const finalVideo = path.join(publicMedia, "gameplay-showcase.mp4");
run(ffmpeg, [
  "-y",
  "-i", rawCut,
  "-vf", "fade=t=in:st=0:d=0.2,fade=t=out:st=15.3:d=0.45",
  "-an",
  "-movflags", "+faststart",
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-preset", "medium",
  "-crf", "21",
  finalVideo,
]);

run(ffmpeg, [
  "-y",
  "-ss", "00:00:14.0",
  "-i", finalVideo,
  "-frames:v", "1",
  "-q:v", "2",
  path.join(publicMedia, "gameplay-showcase-poster.jpg"),
]);

run(ffmpeg, [
  "-y",
  "-i", finalVideo,
  "-vf", "fps=1/1.3,scale=384:-1,tile=6x3",
  "-frames:v", "1",
  path.join(derived, "dynamic_showcase_proof_sheet.jpg"),
]);

run(ffprobe, [
  "-v", "error",
  "-show_entries", "format=duration,size,bit_rate",
  "-show_entries", "stream=codec_type,codec_name,width,height,avg_frame_rate",
  "-of", "json",
  finalVideo,
]);
