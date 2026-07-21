import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [section1, section2, section3, section4, section5, section6, section7, faq, workspace] = await Promise.all([
  read("../app/help/sections/Section1.js"),
  read("../app/help/sections/Section2.js"),
  read("../app/help/sections/Section3.js"),
  read("../app/help/sections/Section4.js"),
  read("../app/help/sections/Section5.js"),
  read("../app/help/sections/Section6.js"),
  read("../app/help/sections/Section7.js"),
  read("../components/FAQ.js"),
  read("../components/legal-arena/CaseWorkspace.js"),
]);

const helpCopy = [section1, section2, section5, section6].join("\n");
assert.doesNotMatch(helpCopy, /same matter cannot be started again/i);
assert.doesNotMatch(helpCopy, /same case stays unavailable/i);
assert.match(section1, /Cases are unlimited/);
assert.match(section1, /generates a new matter/);
assert.match(section2, /generate a fresh\s+case immediately/);
assert.match(section5, /expires after seven days/);
assert.match(section5, /Courtroom rounds are turn-based/);
assert.match(section5, /24-hour response window/);
assert.match(section5, /Quitting is a forfeit/);
assert.match(section6, /older completed matters[\s\S]*lawyer-profile archives|lawyer-profile archives[\s\S]*older completed matters/);
assert.match(section7, /Every player begins at 1,000/);
assert.match(section7, /Win[\s\S]*\+18/);
assert.match(section7, /Draw[\s\S]*\+6/);
assert.match(section7, /Loss[\s\S]*-8/);
assert.match(section7, /cannot fall below 800/);
assert.match(section7, /PVP challenge results:[\s\S]*do not change your overall or specialty rating/);
assert.match(section7, /Settlements:[\s\S]*do not add or remove rating/);
assert.match(section7, /rating first, completed matters second,[\s\S]*XP third/);
assert.match(faq, /keep generating new cases without waiting/);
assert.match(workspace, /start a fresh case immediately/);
assert.match(section1, /\/help\/screenshots\/case-selection\.png/);
assert.match(section2, /\/help\/screenshots\/fact-sheet\.png/);
assert.match(section3, /\/help\/screenshots\/courtroom\.png/);
assert.match(section4, /\/help\/screenshots\/settlement\.png/);
assert.match(section5, /\/help\/screenshots\/pvp-docket\.png/);
assert.match(section6, /\/help\/screenshots\/country-picker\.png/);
await Promise.all([
  access(new URL("../public/help/screenshots/case-selection.png", import.meta.url)),
  access(new URL("../public/help/screenshots/fact-sheet.png", import.meta.url)),
  access(new URL("../public/help/screenshots/courtroom.png", import.meta.url)),
  access(new URL("../public/help/screenshots/settlement.png", import.meta.url)),
  access(new URL("../public/help/screenshots/pvp-docket.png", import.meta.url)),
  access(new URL("../public/help/screenshots/country-picker.png", import.meta.url)),
]);

console.log("Help content accuracy tests passed");
