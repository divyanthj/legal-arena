import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { articles } from "../_assets/content";
import BadgeCategory from "../_assets/components/BadgeCategory";
import Avatar from "../_assets/components/Avatar";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export function generateStaticParams() {
  return articles.map((article) => ({
    articleId: article.slug,
  }));
}

export async function generateMetadata({ params }) {
  const article = articles.find((article) => article.slug === params.articleId);
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
  const article = articles.find((article) => article.slug === params.articleId);
  if (!article) {
    notFound();
  }

  const articlesRelated = articles
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
            image: `https://${config.domainName}${article.image.urlRelative}`,
            datePublished: article.publishedAt,
            dateModified: article.publishedAt,
            author: {
              "@type": "Person",
              name: article.author.name,
            },
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
            {article.content}
          </section>
        </div>
      </article>
    </>
  );
}
