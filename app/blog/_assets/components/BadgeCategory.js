import Link from "next/link";

// This is the category badge that appears in the article page and in <CardArticle /> component
const Category = ({ category, extraStyle }) => {
  return (
    <Link
      href={`/blog/category/${category.slug}`}
      className={`inline-flex rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/68 transition hover:border-white/28 hover:bg-white/10 hover:text-white ${
        extraStyle ? extraStyle : ""
      }`}
      title={`Posts in ${category.title}`}
      rel="tag"
    >
      {category.titleShort}
    </Link>
  );
};

export default Category;
