import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const contentPath = path.join(rootDir, "app", "blog", "_assets", "content.js");
const source = readFileSync(contentPath, "utf8");

const articlesIndex = source.indexOf("export const articles = [");
if (articlesIndex === -1) {
  fail("Could not find export const articles in blog content.");
}

const articleSource = source.slice(articlesIndex);
const articleStarts = [...articleSource.matchAll(/\n  \{\n    slug:\s*"([^"]+)"/g)];
if (articleStarts.length === 0) {
  fail("No blog article objects found.");
}

const errors = [];
const slugs = new Set();
const titles = new Set();

const requiredFields = ["slug", "title", "description", "publishedAt", "image", "content"];

for (let index = 0; index < articleStarts.length; index += 1) {
  const start = articleStarts[index].index;
  const end = articleStarts[index + 1]?.index ?? articleSource.length;
  const block = articleSource.slice(start, end);
  const slug = getStringField(block, "slug");
  const title = getStringField(block, "title");
  const publishedAt = getStringField(block, "publishedAt");
  const urlRelative = getStringField(block, "urlRelative");

  for (const field of requiredFields) {
    if (!new RegExp(`\\b${field}\\s*:`).test(block)) {
      errors.push(`${slug || `article ${index + 1}`} is missing ${field}.`);
    }
  }

  if (!/categories:\s*\[[\s\S]*?categories\.find/.test(block)) {
    errors.push(`${slug || `article ${index + 1}`} must reference at least one existing blog category.`);
  }

  if (!/author:\s*authors\.find/.test(block)) {
    errors.push(`${slug || `article ${index + 1}`} must use an existing blog author.`);
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "")) {
    errors.push(`${slug || `article ${index + 1}`} must use a lowercase kebab-case slug.`);
  }

  if (slugs.has(slug)) {
    errors.push(`Duplicate blog slug: ${slug}.`);
  }
  slugs.add(slug);

  if (titles.has(title)) {
    errors.push(`Duplicate blog title: ${title}.`);
  }
  titles.add(title);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt || "")) {
    errors.push(`${slug} must use publishedAt format YYYY-MM-DD.`);
  }

  if (!urlRelative || !urlRelative.startsWith("/images/")) {
    errors.push(`${slug} image.urlRelative must point to /images/...`);
  } else {
    const imagePath = path.join(rootDir, "public", urlRelative);
    if (!existsSync(imagePath)) {
      errors.push(`${slug} image file does not exist: public${urlRelative}`);
    }
  }

  if (!/not legal advice|does not replace a lawyer/i.test(block)) {
    errors.push(`${slug} should include the standard game/simulator, not-legal-advice disclaimer.`);
  }
}

if (errors.length > 0) {
  fail(errors.join("\n"));
}

console.log(`Blog content check passed for ${articleStarts.length} article(s).`);

function getStringField(block, fieldName) {
  const match = block.match(new RegExp(`\\b${fieldName}\\s*:\\s*"([^"]+)"`));
  return match?.[1] || "";
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
