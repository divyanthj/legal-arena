import assert from "node:assert/strict";
import { markdownToSafeHtml, styleEmailMarkdown } from "../libs/markdown.js";

const html = markdownToSafeHtml(`
# Product update

- **Published cases**
- [Read the blog](https://legalarena.app/blog)

> Build your reputation.

| Feature | Status |
| --- | --- |
| Case reports | Live |
`);

assert.match(html, /<h1>Product update<\/h1>/);
assert.match(html, /<strong>Published cases<\/strong>/);
assert.match(html, /<a href="https:\/\/legalarena\.app\/blog">Read the blog<\/a>/);
assert.match(html, /<blockquote>Build your reputation\.<\/blockquote>/);
assert.match(html, /<table>/);
assert.doesNotMatch(markdownToSafeHtml("<script>alert(1)</script>"), /<script>/);
assert.match(styleEmailMarkdown(html), /style="[^"]*color:#fff/);

console.log("Markdown email tests passed.");
