import "server-only";
import { articles, categories, authors } from "./content";
import { getPublishedCaseReportBySlug, listPublishedCaseReports } from "@/libs/caseReports";

const categoryFor = (slug) => categories.find((category) => category.slug === slug) || {
  slug,
  title: String(slug || "Case Reports").split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
  titleShort: String(slug || "Cases").split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "),
  description: `Legal Arena reports about ${String(slug || "court cases").replace(/-/g, " ")}.`,
  descriptionShort: `Reports about ${String(slug || "court cases").replace(/-/g, " ")}.`,
};
const cleanReportCopy = (value = "") => String(value || "")
  .replace(/This (?:report covers|is) [^.]*fictional[^.]*\.(?:\s*This is not legal advice\.)?/gi, "")
  .replace(/\bfictional\s+/gi, "")
  .replace(/\bsimulated\s+/gi, "")
  .replace(/\s{2,}/g, " ")
  .trim();
const normalize = (post) => ({
  dynamic: true,
  slug: post.slug,
  title: cleanReportCopy(post.title),
  description: cleanReportCopy(post.description),
  categories: (post.categories || []).map(categoryFor),
  author: authors[0],
  playerName: post.author?.name || "Legal Arena advocate",
  playerId: String(post.author?.playerId || ""),
  advocates: (post.advocates?.length ? post.advocates : post.author?.playerId ? [{ name: post.author.name, playerId: post.author.playerId }] : [])
    .map((advocate) => ({ name: cleanReportCopy(advocate.name), playerId: String(advocate.playerId || "") }))
    .filter((advocate) => advocate.name && advocate.playerId),
  publishedAt: post.publishedAt,
  image: { src: post.image?.url, urlRelative: post.image?.url, alt: cleanReportCopy(post.image?.alt || post.title) },
  sections: (post.sections || []).map((section) => ({
    ...section,
    heading: cleanReportCopy(section.heading),
    paragraphs: (section.paragraphs || []).map(cleanReportCopy).filter(Boolean),
    bullets: (section.bullets || []).map(cleanReportCopy).filter(Boolean),
    quote: cleanReportCopy(section.quote),
  })),
  caseDetails: post.caseDetails || {},
  tags: post.tags || [],
});

export const getAllBlogArticles = async () => {
  try {
    const generated = (await listPublishedCaseReports()).map(normalize);
    return [...generated, ...articles].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  } catch (error) {
    console.error("Could not load generated case reports:", error);
    return [...articles].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }
};

export const getBlogArticle = async (slug) => {
  const staticArticle = articles.find((article) => article.slug === slug);
  if (staticArticle) return staticArticle;
  try {
    const post = await getPublishedCaseReportBySlug(slug);
    return post ? normalize(post) : null;
  } catch (error) {
    console.error("Could not load generated case report:", error);
    return null;
  }
};
