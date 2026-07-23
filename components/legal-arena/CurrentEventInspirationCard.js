"use client";

import * as HeroIcons from "@heroicons/react/24/outline";

const formatDate = (value = "") => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
      }).format(date);
};

export default function CurrentEventInspirationCard({ inspiration }) {
  if (!inspiration?.sources?.length) return null;

  return (
    <section className="mt-5 rounded-2xl border border-sky-200/20 bg-sky-300/[0.055] p-4 text-left sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-sky-200/20 bg-sky-200/[0.08] text-sky-100">
          <HeroIcons.NewspaperIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="arena-kicker text-sky-200">Behind the headline</p>
          <h3 className="mt-2 text-xl font-black text-white">
            Real reporting inspired this fictional matter
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/58">
            {inspiration.disclaimer}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {inspiration.sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-sky-200/30"
          >
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-5 text-white/82 group-hover:text-sky-100">
                {source.title}
              </span>
              <span className="mt-1 block text-xs font-semibold text-white/42">
                {[source.publisher, formatDate(source.publishedAt)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <HeroIcons.ArrowTopRightOnSquareIcon
              className="mt-0.5 h-4 w-4 shrink-0 text-white/38 group-hover:text-sky-100"
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </section>
  );
}

