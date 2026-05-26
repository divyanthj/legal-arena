import { categories, articles } from "./_assets/content";
import CardArticle from "./_assets/components/CardArticle";
import CardCategory from "./_assets/components/CardCategory";
import config from "@/config";
import { getSEOTags } from "@/libs/seo";

export const metadata = getSEOTags({
  title: `${config.appName} Blog | Lawyer Game & Courtroom Strategy`,
  description:
    "Articles about lawyer games, AI courtroom simulations, case-building, and argument strategy in Legal Arena.",
  canonicalUrlRelative: "/blog",
});

export default async function Blog() {
  const articlesToDisplay = articles
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 6);

  return (
    <>
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-16 text-center md:px-8 md:py-24">
          <p className="arena-kicker">Courtroom strategy notes</p>
          <h1 className="arena-headline mx-auto mt-5 max-w-4xl text-5xl uppercase leading-[0.92] md:text-7xl">
          The Legal Arena Blog
        </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/68 md:text-xl">
          Read about online lawyer games, courtroom simulation, case-building,
          and argument strategy.
        </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <div className="mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/40">
              Latest posts
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Read the case file
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-white/52 md:text-right">
            Practical essays for players who want sharper interviews, cleaner case
            theories, and better courtroom arguments.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {articlesToDisplay.map((article, i) => (
            <CardArticle
              article={article}
              key={article.slug}
              isImagePriority={i <= 2}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-black/45">
        <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/40">
            Browse by category
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {categories.map((category) => (
              <CardCategory key={category.slug} category={category} tag="div" />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
