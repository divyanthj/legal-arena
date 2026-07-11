import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-unsubscribe-secret";
const { createUnsubscribeToken, verifyUnsubscribeToken } = await import("../libs/emailUnsubscribe.js");

const token = createUnsubscribeToken("Person@Example.com");
assert.equal(verifyUnsubscribeToken(token), "person@example.com");
assert.equal(verifyUnsubscribeToken(`${token}changed`), null);
assert.equal(verifyUnsubscribeToken("invalid"), null);

const page = await readFile(new URL("../app/unsubscribe/UnsubscribeConfirmation.js", import.meta.url), "utf8");
assert.match(page, /unsubscribe_page_visited/);
assert.match(page, /unsubscribe_confirmed/);
assert.match(page, /Yes, unsubscribe/);
assert.match(page, /No, keep emails/);

const template = await readFile(new URL("../libs/emailTemplate.js", import.meta.url), "utf8");
assert.match(template, /Unsubscribe from mailing list/);
assert.match(template, /unsubscribeUrl/);

const api = await readFile(new URL("../app/api/unsubscribe/route.js", import.meta.url), "utf8");
assert.match(api, /verifyUnsubscribeToken/);
assert.match(api, /EmailSuppression\.findOneAndUpdate/);
assert.match(api, /Self-unsubscribed/);

console.log("Unsubscribe tests passed.");
