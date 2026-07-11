import config from "@/config";
import { articles, categories } from "@/app/blog/_assets/content";
import { listPublishedCaseReports } from "@/libs/caseReports";

export const dynamic = "force-dynamic";

export default async function sitemap() {
  const base = `https://${config.domainName}`;
  let generated = [];
  try { generated = await listPublishedCaseReports(); } catch (error) { console.error("Could not add case reports to sitemap:", error); }
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/blog`, lastModified: new Date() },
    { url: `${base}/faq`, lastModified: new Date() },
    { url: `${base}/contact`, lastModified: new Date() },
    { url: `${base}/help`, lastModified: new Date() },
    ...categories.map((category) => ({ url: `${base}/blog/category/${category.slug}`, lastModified: new Date() })),
    ...articles.map((article) => ({ url: `${base}/blog/${article.slug}`, lastModified: new Date(article.publishedAt) })),
    ...generated.map((post) => ({ url: `${base}/blog/${post.slug}`, lastModified: post.updatedAt || post.publishedAt })),
  ];
}
