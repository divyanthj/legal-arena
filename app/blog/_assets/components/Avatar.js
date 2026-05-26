import Link from "next/link";
import Image from "next/image";

// This is the author avatar that appears in the article page and in <CardArticle /> component
const Avatar = ({ article }) => {
  return (
    <Link
      href={`/blog/author/${article.author.slug}`}
      title={`Posts by ${article.author.name}`}
      className="group inline-flex items-center gap-3 text-white/62 transition hover:text-white"
      rel="author"
    >
      <span itemProp="author">
        <Image
          src={article.author.avatar}
          // alt={`Avatar of ${article.author.name}`}
          alt=""
          className="h-8 w-8 rounded-full border border-white/10 object-cover object-center"
          width={28}
          height={28}
        />
      </span>
      <span className="text-sm font-medium">{article.author.name}</span>
    </Link>
  );
};

export default Avatar;
