import Link from "next/link";
import Image from "next/image";
import BadgeCategory from "./BadgeCategory";
import Avatar from "./Avatar";

// This is the article card that appears in the home page, in the category page, and in the author's page
const CardArticle = ({
  article,
  tag = "h2",
  showCategory = true,
  isImagePriority = false,
}) => {
  const TitleTag = tag;

  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] text-white transition hover:border-white/22 hover:bg-white/[0.055]">
      {article.image?.src && (
        <Link
          href={`/blog/${article.slug}`}
          className="block"
          title={article.title}
          rel="bookmark"
        >
          <figure className="overflow-hidden border-b border-white/10 bg-black">
            <Image
              src={article.image.src}
              alt={article.image.alt}
              width={600}
              height={338}
              priority={isImagePriority}
              placeholder={typeof article.image.src === "string" ? "empty" : "blur"}
              className="aspect-video w-full object-cover object-center opacity-80 transition duration-300 group-hover:scale-[1.03] group-hover:opacity-100"
            />
          </figure>
        </Link>
      )}
      <div className="p-6 md:p-7">
        {/* CATEGORIES */}
        {showCategory && (
          <div className="mb-5 flex flex-wrap gap-2">
            {article.categories.map((category) => (
              <BadgeCategory category={category} key={category.slug} />
            ))}
          </div>
        )}

        {/* TITLE WITH RIGHT TAG */}
        <TitleTag className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
          <Link
            href={`/blog/${article.slug}`}
            className="transition hover:text-white/78"
            title={article.title}
            rel="bookmark"
          >
            {article.title}
          </Link>
        </TitleTag>

        <div className="mt-4 space-y-6 text-white/62">
          {/* DESCRIPTION */}
          <p className="text-base leading-7">{article.description}</p>

          {/* AUTHOR & DATE */}
          <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-5 text-sm">
            <Avatar article={article} />
            {article.playerName ? (
              article.playerId ? <Link href={`/dashboard/players/${article.playerId}`} className="text-white/62 transition hover:text-amber-200">Featuring {article.playerName}</Link> : <span className="text-white/62">Featuring {article.playerName}</span>
            ) : null}

            <span className="text-white/42" itemProp="datePublished">
              {new Date(article.publishedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default CardArticle;
