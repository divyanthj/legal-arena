import Image from "next/image";
import { authors, articles } from "../../_assets/content";
import CardArticle from "../../_assets/components/CardArticle";
import { notFound } from "next/navigation";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";

export function generateStaticParams() {
  return authors.map((author) => ({
    authorId: author.slug,
  }));
}

export async function generateMetadata({ params }) {
  const author = authors.find((author) => author.slug === params.authorId);
  if (!author) {
    return {};
  }

  return getSEOTags({
    title: `${author.name}, Author at ${config.appName}'s Blog`,
    description: `${author.name}, Author at ${config.appName}'s Blog`,
    canonicalUrlRelative: `/blog/author/${author.slug}`,
  });
}

export default async function Author({ params }) {
  const author = authors.find((author) => author.slug === params.authorId);
  if (!author) {
    notFound();
  }

  const articlesByAuthor = articles
    .filter((article) => article.author.slug === author.slug)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  return (
    <>
      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-16 md:grid-cols-[1fr_auto] md:px-8 md:py-24 md:items-center">
          <div>
            <p className="arena-kicker">Author</p>
            <h1 className="arena-headline mt-4 text-5xl uppercase leading-[0.92] md:text-7xl">
              {author.name}
            </h1>
            <p className="mt-4 text-lg font-medium text-white/78">{author.job}</p>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/62">
              {author.description}
          </p>
          </div>

          <div className="flex gap-4 md:flex-col">
            <Image
              src={author.avatar}
              width={256}
              height={256}
              alt={author.name}
              priority={true}
              className="w-36 rounded-[1.75rem] border border-white/10 object-cover md:w-56"
            />

            {author.socials?.length > 0 && (
              <div className="flex gap-3">
              {author.socials.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white"
                  title={`Go to ${author.name} profile on ${social.name}`}
                  target="_blank"
                >
                  {social.icon}
                </a>
              ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.28em] text-white/40">
          Most recent articles
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {articlesByAuthor.map((article) => (
            <CardArticle key={article.slug} article={article} />
          ))}
        </div>
      </section>
    </>
  );
}
