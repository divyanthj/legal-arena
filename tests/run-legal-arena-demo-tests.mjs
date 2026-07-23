import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/itch/legal-arena-demo.html", import.meta.url), "utf8");

assert.match(html, /Security Deposit Showdown/);
assert.match(html, /Maya Chen/);
assert.match(html, /Harbor Point Rentals/);
assert.match(html, /Fully playable offline/);
assert.match(html, /legalArenaOfflineDemoStateV1/);
assert.match(html, /runOfflineInterview/);
assert.match(html, /runOfflineCourtroom/);
assert.match(html, /bindEnterToSubmit/);
assert.match(html, /event\.key === "Enter" && !event\.shiftKey/);
assert.match(html, /inline-thinking/);
assert.match(html, /OPPONENT_RESPONSES/);
assert.match(html, /Enter Legal Arena/);
assert.match(html, /data:image\/png;base64,/);
assert.doesNotMatch(html, /fetch\s*\(/);
assert.doesNotMatch(html, /XMLHttpRequest|WebSocket|EventSource/);
assert.doesNotMatch(html, /\/api\/demo|X-Legal-Arena-Demo-Token/);
assert.doesNotMatch(html, /connect-src\s+https?:/);
assert.doesNotMatch(html, /function renderLoading/);
assert.doesNotMatch(html, /data-question=|querySelectorAll\("\.suggestion"\)/);
assert.doesNotMatch(html, /<script\s+src=/i);
assert.doesNotMatch(html, /<link\s+[^>]*href=/i);
assert.doesNotMatch(html, /OPENAI_API_KEY|NEXTAUTH_SECRET|LEGAL_ARENA_DEMO_SECRET/);
assert.doesNotMatch(html, /signIn|\/api\/auth/i);

console.log("Legal Arena standalone offline demo tests passed");
