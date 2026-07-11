import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const model = await readFile(new URL("../models/EmailSuppression.js", import.meta.url), "utf8");
assert.match(model, /email: \{[^}]*unique: true[^}]*index: true/s);

const sender = await readFile(new URL("../libs/emailSender.js", import.meta.url), "utf8");
assert.match(sender, /EmailSuppression\.find/);
assert.match(sender, /deliverableRecipients/);
assert.match(sender, /suppressedCount/);
const broadcastStart = sender.indexOf("export async function sendBroadcastEmail");
const customStart = sender.indexOf("export async function sendCustomEmail");
assert.ok(sender.indexOf("EmailSuppression.find", broadcastStart) < customStart, "suppression must be applied inside broadcast delivery");

const route = await readFile(new URL("../app/api/admin/email-suppressions/route.js", import.meta.url), "utf8");
assert.match(route, /export async function GET/);
assert.match(route, /export async function POST/);
assert.match(route, /export async function DELETE/);
assert.match(route, /isAdminEmail/);

console.log("Email suppression tests passed.");
