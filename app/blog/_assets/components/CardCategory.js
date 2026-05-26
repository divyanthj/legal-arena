import Link from "next/link";

// This is the category card that appears in the home page and in the category page
const CardCategory = ({ category, tag = "h2" }) => {
  const TitleTag = tag;

  return (
    <Link
      className="group block rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 text-white transition hover:border-white/22 hover:bg-white/[0.06]"
      href={`/blog/category/${category.slug}`}
      title={category.title}
      rel="tag"
    >
      <p className="text-xs uppercase tracking-[0.24em] text-white/38">
        Category
      </p>
      <TitleTag className="mt-4 text-xl font-semibold tracking-tight">
        {category?.titleShort || category.title}
      </TitleTag>
      <p className="mt-3 text-sm leading-6 text-white/55">
        {category.descriptionShort || category.description}
      </p>
    </Link>
  );
};

export default CardCategory;
