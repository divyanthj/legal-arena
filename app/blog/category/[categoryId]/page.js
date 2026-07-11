import { categories } from "../../_assets/content";
import { getAllBlogArticles } from "../../_assets/runtime";
import CardArticle from "../../_assets/components/CardArticle";
import CardCategory from "../../_assets/components/CardCategory";
import { notFound } from "next/navigation";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return categories.map((category) => ({
    categoryId: category.slug,
  }));
}

export async function generateMetadata({ params }) {
  let category = categories.find(
    (category) => category.slug === params.categoryId
  );
  if (!category) {
    const matchedArticle = (await getAllBlogArticles()).find((article) =>
      article.categories.some((candidate) => candidate.slug === params.categoryId)
    );
    category = matchedArticle?.categories.find((candidate) => candidate.slug === params.categoryId);
  }
  if (!category) {
    return {};
  }

  return getSEOTags({
    title: `${category.title} | Blog by ${config.appName}`,
    description: category.description,
    canonicalUrlRelative: `/blog/category/${category.slug}`,
  });
}

export default async function Category({ params }) {
  const allArticles = await getAllBlogArticles();
  let category = categories.find(
    (category) => category.slug === params.categoryId
  );
  if (!category) {
    const matchedArticle = allArticles.find((article) =>
      article.categories.some((candidate) => candidate.slug === params.categoryId)
    );
    category = matchedArticle?.categories.find((candidate) => candidate.slug === params.categoryId);
  }
  if (!category) {
    notFound();
  }

  const articlesInCategory = allArticles
    .filter((article) =>
      article.categories.map((c) => c.slug).includes(category.slug)
    )
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 3);

  return (
    <>
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center md:px-8 md:py-24">
          <p className="arena-kicker">Blog category</p>
          <h1 className="arena-headline mt-5 text-5xl uppercase leading-[0.92] md:text-7xl">
          {category.title}
        </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/68 md:text-xl">
          {category.description}
        </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/40">
          Most recent articles
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {articlesInCategory.map((article) => (
            <CardArticle
              key={article.slug}
              article={article}
              tag="h3"
              showCategory={false}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-black/45">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/40">
            Other categories
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
          {categories
            .filter((c) => c.slug !== category.slug)
            .map((category) => (
              <CardCategory key={category.slug} category={category} tag="h3" />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
