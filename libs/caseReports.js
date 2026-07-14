import "server-only";

import { put, get } from "@vercel/blob";
import sharp from "sharp";
import connectMongo from "@/libs/mongoose";
import { requestStructuredCompletion } from "@/libs/gpt";
import BlogPost from "@/models/BlogPost";
import CaseSession from "@/models/CaseSession";
import Challenge from "@/models/Challenge";
import User from "@/models/User";

const IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1.5";
const SECTION_HEADINGS = [
  "The dispute", "The evidence", "The arguments", "The decisive strategy",
  "The ruling", "Advocate performance", "Remaining weaknesses",
  "Why the decision matters", "Could another advocate have changed the result?", "Play the lawyer",
];

const id = (value) => String(value?._id || value?.id || value || "");
const sameId = (left, right) => id(left) === id(right);
const clean = (value, max = 10000) => String(value || "").trim().slice(0, max);
const slugify = (value) => clean(value, 100).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const uniqueTags = (values = []) => [...new Set(values.map((value) => clean(value, 80).toLowerCase()).filter(Boolean))].slice(0, 20);
const publicStatus = (post, viewerId = "") => post ? ({
  status: post.status,
  slug: post.status === "published" ? post.slug : "",
  waitingForOpponent: post.status === "awaiting_consent",
  viewerConsented: (post.consentedUserIds || []).some((value) => sameId(value, viewerId)),
  canRetry: post.status === "failed",
  generationStage: post.generationStage || "",
}) : ({ status: "not_started", slug: "", waitingForOpponent: false, viewerConsented: false, canRetry: false });

export const getCaseReportStatus = async ({ sourceType, sourceId, viewerId }) => {
  await connectMongo();
  const post = await BlogPost.findOne({ sourceType, sourceId, participantUserIds: viewerId }).lean();
  return publicStatus(post, viewerId);
};

const buildSource = async ({ sourceType, sourceId, userId }) => {
  await connectMongo();
  if (sourceType === "caseSession") {
    const source = await CaseSession.findOne({ _id: sourceId, userId }).lean();
    if (!source) throw Object.assign(new Error("Case not found."), { status: 404 });
    if (source.status !== "verdict" || !source.verdict?.winner) throw Object.assign(new Error("A final verdict is required before publishing."), { status: 400 });
    const users = await User.find({ _id: source.userId }).select("name image allowPortraitInCaseReports").lean();
    return { source, users, participantIds: [source.userId] };
  }
  const source = await Challenge.findOne({ _id: sourceId, "participants.userId": userId }).lean();
  if (!source) throw Object.assign(new Error("Challenge not found."), { status: 404 });
  if (source.status !== "verdict" || !source.verdict?.winner) throw Object.assign(new Error("A final verdict is required before publishing."), { status: 400 });
  const participantIds = source.participants.map((participant) => participant.userId);
  const users = await User.find({ _id: { $in: participantIds } }).select("name image allowPortraitInCaseReports").lean();
  return { source, users, participantIds };
};

const sourceForPrompt = ({ sourceType, source, users }) => ({
  sourceType,
  title: source.title,
  practiceArea: source.practiceArea,
  category: source.primaryCategory,
  caseCountry: source.caseCountry || null,
  premise: source.premise,
  factSheet: source.factSheet,
  courtroomTranscript: source.courtroomTranscript,
  courtroomRounds: source.courtroomRounds,
  score: source.score,
  verdict: source.verdict,
  players: users.map((user) => ({ id: id(user), name: clean(user.name, 100) || "Legal Arena advocate" })),
});

const validateArticle = (value) => {
  const sections = Array.isArray(value?.sections) ? value.sections.slice(0, 14).map((section) => ({
    heading: clean(section?.heading, 120),
    paragraphs: (Array.isArray(section?.paragraphs) ? section.paragraphs : []).map((p) => clean(p, 2500)).filter(Boolean).slice(0, 8),
    bullets: (Array.isArray(section?.bullets) ? section.bullets : []).map((p) => clean(p, 500)).filter(Boolean).slice(0, 10),
    quote: clean(section?.quote, 1000),
  })).filter((section) => section.heading && (section.paragraphs.length || section.bullets.length || section.quote)) : [];
  if (!clean(value?.title, 140) || !clean(value?.description, 220) || sections.length < 6) throw new Error("The generated case report was incomplete.");
  return { title: clean(value.title, 140), description: clean(value.description, 220), imagePrompt: clean(value.imagePrompt, 1800), imageAlt: clean(value.imageAlt, 240), tags: uniqueTags(Array.isArray(value?.tags) ? value.tags : []), sections };
};

const generateArticle = async ({ sourceType, source, users, userId }) => validateArticle(await requestStructuredCompletion({
  userId: id(userId),
  maxTokens: 7000,
  retryAttempts: 1,
  throwOnError: true,
  usageLabel: "case-report",
  systemPrompt: `You are the Legal Arena court reporter. Write an accurate, compelling SEO-oriented court report in the style of conventional real-world legal journalism. Never invent evidence, quotations, money awards, scores, legal rules, or names. Do not use the words fictional, simulated, simulation, or game in the title, description, image alt text, or report sections. Do not add a disclaimer inside the generated report; the application renders one separately below the headline. Return JSON with title, description, imagePrompt, imageAlt, tags, and sections. Tags must be 6-12 concise lowercase search phrases grounded in the record, covering the legal issue, remedy, evidence, jurisdiction/court, and advocacy topic. Sections must use these editorial beats: ${SECTION_HEADINGS.join("; ")}. Each section has heading, paragraphs (array), bullets (array), and quote (string). Attribute advocacy to the player names. End with a concise invitation to take on a similar case in Legal Arena. The image prompt must request a photorealistic 3:2 landscape editorial courtroom image with no text, logos, watermarks, or celebrity likeness.`,
  userPrompt: `Create the case report solely from this record:\n${JSON.stringify(sourceForPrompt({ sourceType, source, users }))}`,
}));

const portraitBuffer = async (user) => {
  const image = clean(user?.image, 2_000_000);
  if (!user?.allowPortraitInCaseReports || !image) return null;
  if (image.startsWith("data:image/")) return Buffer.from(image.split(",")[1] || "", "base64");
  if (image.startsWith("/api/players/avatar/") && process.env.BLOB_READ_WRITE_TOKEN) {
    const result = await get(`lawyer-headshots/${id(user)}.webp`, { access: "private" });
    return result?.stream ? Buffer.from(await new Response(result.stream).arrayBuffer()) : null;
  }
  if (/^https?:\/\//.test(image)) {
    const response = await fetch(image);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
  }
  return null;
};

const generateImage = async ({ article, portrait }) => {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");
  const prompt = `${article.imagePrompt} This is a fictional Legal Arena simulation. Photorealistic editorial courtroom photography, landscape 3:2 composition. No text, captions, logos, watermarks, celebrity likeness, or suggestion that this is a real news photograph.`;
  let response;
  if (portrait) {
    const normalized = await sharp(portrait).rotate().resize(1024, 1024, { fit: "contain" }).png().toBuffer();
    const body = new FormData();
    body.append("model", IMAGE_MODEL);
    body.append("image", new Blob([normalized], { type: "image/png" }), "lawyer.png");
    body.append("prompt", `${prompt} Preserve the supplied lawyer's facial identity and feature that lawyer arguing in court.`);
    body.append("size", "1536x1024"); body.append("quality", "medium"); body.append("output_format", "webp"); body.append("output_compression", "84");
    response = await fetch(IMAGE_EDITS_URL, { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body });
  } else {
    response = await fetch(IMAGE_GENERATIONS_URL, { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1536x1024", quality: "medium", output_format: "webp", output_compression: 84 }) });
  }
  if (!response.ok) throw new Error(`Image generation failed (${response.status}).`);
  const payload = await response.json();
  const encoded = payload?.data?.[0]?.b64_json;
  if (!encoded) throw new Error("Image generation returned no image.");
  return { buffer: await sharp(Buffer.from(encoded, "base64")).resize(1536, 1024, { fit: "cover" }).webp({ quality: 84 }).toBuffer(), prompt };
};

const generateAndPublish = async ({ post, sourceType, source, users, userId }) => {
  try {
    post.generationStage = "writing";
    await post.save();
    const article = await generateArticle({ sourceType, source, users, userId });
    post.generationStage = "generating_image";
    await post.save();
    const portraitUser = users.find((user) => user.allowPortraitInCaseReports && user.image);
    const generated = await generateImage({ article, portrait: await portraitBuffer(portraitUser) });
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Public blob storage is not configured.");
    post.generationStage = "storing_image";
    await post.save();
    await put(`case-reports/${post.slug}.webp`, generated.buffer, { access: "private", contentType: "image/webp", addRandomSuffix: false, allowOverwrite: true });
    post.title = article.title; post.description = article.description; post.sections = article.sections;
    post.categories = uniqueTags(["case-reports", slugify(source.primaryCategory || source.practiceArea)]);
    post.tags = uniqueTags([
      ...article.tags,
      source.practiceArea,
      source.primaryCategory,
      source.premise?.courtName,
      source.premise?.clientName,
      source.premise?.opponentName,
      ...users.map((user) => user.name),
      source.verdict?.winner,
    ]);
    post.image = { url: `/case-report-images/${post.slug}`, alt: article.imageAlt, prompt: generated.prompt, width: 1536, height: 1024 };
    const publishingUser = users.find((user) => sameId(user, userId));
    post.author.name = clean(publishingUser?.name, 100) || "Legal Arena advocate";
    post.advocates = users.map((user) => ({
      name: clean(user.name, 100) || "Legal Arena advocate",
      playerId: user._id,
    }));
    post.status = "published"; post.generationStage = "published"; post.publishedAt = new Date(); post.generationError = "";
    await post.save();
  } catch (error) {
    post.status = "failed"; post.generationStage = "failed"; post.generationError = clean(error?.message || error, 1000); await post.save(); throw error;
  }
  return post;
};

export const publishCaseReport = async ({ sourceType, sourceId, userId }) => {
  const { source, users, participantIds } = await buildSource({ sourceType, sourceId, userId });
  let post = await BlogPost.findOne({ sourceType, sourceId });
  if (post?.status === "published" || post?.status === "unpublished") return publicStatus(post, userId);
  const isPvp = sourceType === "challenge";
  let claimedGeneration = false;
  if (!post) {
    try {
      post = await BlogPost.create({ sourceType, sourceId, participantUserIds: participantIds, consentedUserIds: [userId], status: isPvp ? "awaiting_consent" : "generating", generationStage: isPvp ? "" : "preparing", slug: `${slugify(source.title) || "legal-arena-case"}-${id(sourceId).slice(-8)}`, categories: ["case-reports", slugify(source.primaryCategory || source.practiceArea)].filter(Boolean), tags: uniqueTags([source.practiceArea, source.primaryCategory, source.premise?.courtName, source.premise?.clientName, source.premise?.opponentName, ...users.map((user) => user.name)]), author: { name: clean(users.find((user) => sameId(user, userId))?.name, 100) || "Legal Arena advocate", playerId: userId, playerImage: users.find((user) => sameId(user, userId))?.image || "" }, advocates: users.map((user) => ({ name: clean(user.name, 100) || "Legal Arena advocate", playerId: user._id })), generationStartedAt: new Date(), caseDetails: { court: source.premise?.courtName || "", practiceArea: source.practiceArea || "", result: source.verdict?.summary || "" } });
      claimedGeneration = !isPvp;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      post = await BlogPost.findOne({ sourceType, sourceId });
    }
  }
  if (!post.consentedUserIds.some((value) => sameId(value, userId))) { post.consentedUserIds.push(userId); await post.save(); }
  if (isPvp && !participantIds.every((participantId) => post.consentedUserIds.some((value) => sameId(value, participantId)))) { post.status = "awaiting_consent"; await post.save(); return publicStatus(post, userId); }
  if (post.status === "generating" && !claimedGeneration) return publicStatus(post, userId);
  if (!claimedGeneration) { post.status = "generating"; post.generationStage = "preparing"; post.generationStartedAt = new Date(); await post.save(); }
  await generateAndPublish({ post, sourceType, source, users, userId });
  return publicStatus(post, userId);
};

export const unpublishCaseReport = async ({ sourceType, sourceId, userId }) => {
  await connectMongo();
  const post = await BlogPost.findOne({ sourceType, sourceId, participantUserIds: userId });
  if (!post) throw Object.assign(new Error("Case report not found."), { status: 404 });
  if (post.status === "unpublished") return publicStatus(post, userId);
  if (post.status !== "published") throw Object.assign(new Error("Only a published report can be unpublished."), { status: 409 });
  post.status = "unpublished"; post.unpublishedAt = new Date(); await post.save();
  return publicStatus(post, userId);
};

export const listPublishedCaseReports = async (query = {}) => { await connectMongo(); return BlogPost.find({ status: "published", ...query }).sort({ publishedAt: -1 }).lean(); };
export const getPublishedCaseReportBySlug = async (slug) => { await connectMongo(); return BlogPost.findOne({ slug, status: "published" }).lean(); };
