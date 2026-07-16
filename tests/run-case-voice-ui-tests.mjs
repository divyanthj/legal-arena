import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const recorderSource = await readFile(
  new URL("../components/legal-arena/useCaseVoiceRecorder.js", import.meta.url),
  "utf8"
);
assert.match(recorderSource, /setSettlementMessage/);
assert.match(recorderSource, /recordingSettlementMessage/);
assert.match(recorderSource, /transcribingSettlementMessage/);
assert.match(recorderSource, /settlementMessageAudioLevel/);
assert.match(recorderSource, /handleSettlementMessageVoiceInput/);
assert.match(recorderSource, /setText: setSettlementMessage/);
assert.match(recorderSource, /Microphone access is blocked/);

const workspaceSource = await readFile(
  new URL("../components/legal-arena/CaseWorkspace.js", import.meta.url),
  "utf8"
);
assert.match(workspaceSource, /questionAudioLevel/);
assert.match(workspaceSource, /<VoiceWaveform level=\{questionAudioLevel\}/);
assert.match(workspaceSource, /<VoiceWaveform level=\{settlementMessageAudioLevel\}/);
assert.match(workspaceSource, /<VoiceWaveform level=\{settlementClientInstructionAudioLevel\}/);
assert.match(workspaceSource, /Send Message/);
assert.doesNotMatch(workspaceSource, /Send Counteroffer/);
assert.doesNotMatch(workspaceSource, /Delivering your terms and waiting for opposing counsel/);

console.log("Case voice UI tests passed.");
