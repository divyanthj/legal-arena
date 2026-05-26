# Codex Blog Generation Workflow

Legal Arena blogs are generated as static repo content. Do not port Backsy's webhook, cron, database, or image-upload automation for this workflow.

## Default Flow

1. Read `app/blog/_assets/content.js` and note existing slugs, titles, categories, authors, internal links, and image imports.
2. Choose the closest existing category first: `lawyer-game` or `courtroom-strategy`.
3. Write the post as a new object in the exported `articles` array, newest posts first.
4. Keep `Legal Arena Team` as the default author unless the user asks for another author.
5. Use an existing public image when it fits. If a new image is needed, add it under `public/images` and import it at the top of the content file.
6. Include SEO-friendly `title`, `description`, `slug`, `publishedAt`, image alt text, internal links, and the standard disclaimer that Legal Arena is a game/training simulator and is not legal advice.
7. Run `npm run blog:check`, then `npm run build`.

## Article Shape

Each generated post must include:

- `slug`: lowercase kebab-case and unique
- `title`: unique, specific, and search-aligned
- `description`: concise meta description for cards and SEO
- `categories`: existing category objects from `categories.find(...)`
- `author`: existing author object from `authors.find(...)`
- `publishedAt`: `YYYY-MM-DD`
- `image`: imported `src`, `/images/...` `urlRelative`, and descriptive `alt`
- `content`: JSX using the local `styles` object, semantic sections, and internal links

## Positioning Rules

- Write for players who like legal strategy, courtroom simulation, argument, debate, and case-building.
- Keep claims about law educational and game-oriented.
- Do not imply Legal Arena gives real legal advice, predicts real court outcomes, or replaces a lawyer.
- Prefer practical, concrete posts over generic SEO filler.
