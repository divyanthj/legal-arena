import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { articles } from "../_assets/content";
import { getAllBlogArticles, getBlogArticle } from "../_assets/runtime";
import BadgeCategory from "../_assets/components/BadgeCategory";
import Avatar from "../_assets/components/Avatar";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const dynamic = "force-dynamic";

const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function LinkedAdvocateText({ text, advocates = [] }) {
  const linkedAdvocates = advocates.filter((advocate) => advocate.name && advocate.playerId);
  if (!linkedAdvocates.length || !text) return text;
  const expression = new RegExp(`(${linkedAdvocates.map((advocate) => escapeRegExp(advocate.name)).sort((a, b) => b.length - a.length).join("|")})`, "gi");
  return String(text).split(expression).map((part, index) => {
    const advocate = linkedAdvocates.find((candidate) => candidate.name.toLowerCase() === part.toLowerCase());
    return advocate ? (
      <Link key={`${advocate.playerId}-${index}`} href={`/dashboard/players/${advocate.playerId}`} className="font-semibold text-amber-200 underline decoration-amber-200/35 underline-offset-4 transition hover:text-amber-100" title={`View ${advocate.name}'s lawyer profile`}>
        {part}
      </Link>
    ) : part;
  });
}

export function generateStaticParams() {
  return articles.map((article) => ({
    articleId: article.slug,
  }));
}

export async function generateMetadata({ params }) {
  const article = await getBlogArticle(params.articleId);
  if (!article) {
    return {};
  }

  return getSEOTags({
    title: article.title,
    description: article.description,
    canonicalUrlRelative: `/blog/${article.slug}`,
    extraTags: {
      openGraph: {
        title: article.title,
        description: article.description,
        url: `/blog/${article.slug}`,
        images: [
          {
            url: article.image.urlRelative,
            width: 1200,
            height: 660,
          },
        ],
        locale: "en_US",
        type: "website",
      },
    },
  });
}

export default async function Article({ params }) {
  const article = await getBlogArticle(params.articleId);
  if (!article) {
    notFound();
  }

  const articlesRelated = (await getAllBlogArticles())
    .filter(
      (a) =>
        a.slug !== params.articleId &&
        a.categories.some((c) =>
          article.categories.map((c) => c.slug).includes(c.slug)
        )
    )
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 3);

  return (
    <>
      {/* SCHEMA JSON-LD MARKUP FOR GOOGLE */}
      <Script
        type="application/ld+json"
        id={`json-ld-article-${article.slug}`}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `https://${config.domainName}/blog/${article.slug}`,
            },
            name: article.title,
            headline: article.title,
            description: article.description,
            image: /^https?:\/\//.test(article.image.urlRelative)
              ? article.image.urlRelative
              : `https://${config.domainName}${article.image.urlRelative}`,
            datePublished: article.publishedAt,
            dateModified: article.publishedAt,
            author: article.dynamic
              ? { "@type": "Organization", name: "Legal Arena Reports" }
              : { "@type": "Person", name: article.author.name },
          }),
        }}
      />

      <article className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-white/50 transition hover:text-white"
          title="Back to Blog"
        >
          <span aria-hidden="true">&lt;-</span>
          Back to Blog
        </Link>

        {/* HEADER WITH CATEGORIES AND DATE AND TITLE */}
        <section className="mt-12 max-w-4xl md:mt-16">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {article.categories.map((category) => (
              <BadgeCategory
                category={category}
                key={category.slug}
              />
            ))}
            <span className="text-sm text-white/42" itemProp="datePublished">
              {new Date(article.publishedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <h1 className="arena-headline text-5xl uppercase leading-[0.92] md:text-7xl">
            {article.title}
          </h1>

          {article.dynamic ? (
            <p className="mt-4 inline-flex rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs leading-5 text-white/52">
              This report covers a fictional proceeding argued and decided inside Legal Arena.
            </p>
          ) : null}

          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68 md:text-xl">
            {article.description}
          </p>
        </section>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          {/* SIDEBAR WITH AUTHORS AND 3 RELATED ARTICLES */}
          <aside className="order-last lg:sticky lg:top-28">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="mb-3 text-xs uppercase tracking-[0.24em] text-white/40">
                Posted by
              </p>
              <Avatar article={article} />

              {articlesRelated.length > 0 && (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <p className="mb-4 text-xs uppercase tracking-[0.24em] text-white/40">
                    Related reading
                  </p>
                  <div className="space-y-5">
                  {articlesRelated.map((article) => (
                    <div key={article.slug}>
                      <p>
                        <Link
                          href={`/blog/${article.slug}`}
                          className="font-medium leading-6 text-white transition hover:text-white/72"
                          title={article.title}
                          rel="bookmark"
                        >
                          {article.title}
                        </Link>
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/50">
                        {article.description}
                      </p>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ARTICLE CONTENT */}
          <section className="max-w-3xl space-y-12 md:space-y-16">
            {article.dynamic ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article.image.src} alt={article.image.alt} width={1536} height={1024} className="aspect-[3/2] w-full rounded-[1.75rem] border border-white/10 object-cover" />
                <div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] p-5 text-white/72">
                  <strong className="text-white">Legal Arena Reports</strong> · Featuring <LinkedAdvocateText text={article.playerName} advocates={article.advocates} />
                </div>
                {article.tags?.length ? (
                  <div className="flex flex-wrap gap-2" aria-label="Article tags">
                    {article.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-white/55">#{tag.replace(/\s+/g, "-")}</span>)}
                  </div>
                ) : null}
                {article.sections.map((section, index) => (
                  <section key={`${section.heading}-${index}`}>
                    <h2 className="mb-5 text-3xl font-semibold tracking-tight text-white lg:text-5xl">{section.heading}</h2>
                    <div className="space-y-5">
                      {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex} className="text-lg leading-8 text-white/68"><LinkedAdvocateText text={paragraph} advocates={article.advocates} /></p>)}
                      {section.quote ? <blockquote className="border-l-2 border-amber-300/60 pl-5 text-xl italic leading-8 text-white/82"><LinkedAdvocateText text={section.quote} advocates={article.advocates} /></blockquote> : null}
                      {section.bullets.length ? <ul className="list-disc space-y-3 pl-6 text-lg leading-8 text-white/68">{section.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}><LinkedAdvocateText text={bullet} advocates={article.advocates} /></li>)}</ul> : null}
                    </div>
                  </section>
                ))}
              </>
            ) : article.content}
          </section>
        </div>
      </article>
    </>
  );
}
