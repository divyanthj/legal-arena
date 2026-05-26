"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import config from "@/config";
import { categories } from "../content";

const links = [
  { href: "/lawyer-game", label: "Lawyer Game" },
  { href: "/blog", label: "All Posts" },
];

const HeaderBlog = () => {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [searchParams]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 text-white backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <Link
          className="inline-flex items-center gap-3"
          href="/"
          title={`${config.appName} homepage`}
        >
          <Image
            src="/logoAndName.png"
            alt={`${config.appName} logo`}
            width={150}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
          <span className="hidden text-sm font-semibold uppercase tracking-[0.18em] text-white sm:inline">
            Legal Arena
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-white/72 lg:flex">
          {links.map((link) => (
            <Link
              href={link.href}
              key={link.href}
              className="transition hover:text-white"
              title={link.label}
            >
              {link.label}
            </Link>
          ))}

          <div className="group relative">
            <button
              className="inline-flex items-center gap-2 text-sm text-white/72 transition hover:text-white"
              type="button"
            >
              Categories
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 text-white/45"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div className="invisible absolute left-1/2 top-full w-80 -translate-x-1/2 pt-4 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <div className="arena-surface overflow-hidden rounded-[1.25rem] p-2">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/blog/category/${category.slug}`}
                    className="block rounded-2xl px-4 py-3 transition hover:bg-white/[0.08]"
                  >
                    <p className="text-sm font-semibold text-white">
                      {category?.titleShort || category.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/52">
                      {category?.descriptionShort || category.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Start Playing
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/5 lg:hidden"
          onClick={() => setIsOpen(true)}
        >
          <span className="sr-only">Open main menu</span>
          <span className="h-px w-5 bg-white before:block before:h-px before:w-5 before:-translate-y-2 before:bg-white before:content-[''] after:block after:h-px after:w-5 after:translate-y-[7px] after:bg-white after:content-['']" />
        </button>
      </nav>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden">
          <div className="ml-auto flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#050505] px-5 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="inline-flex items-center gap-3">
                <Image
                  src="/logoAndName.png"
                  alt={`${config.appName} logo`}
                  width={150}
                  height={36}
                  className="h-9 w-auto object-contain"
                />
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-white">
                  Legal Arena
                </span>
              </Link>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-xl text-white"
                onClick={() => setIsOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                x
              </button>
            </div>

            <div className="mt-10 flex flex-col gap-5 text-lg font-semibold text-white">
              {links.map((link) => (
                <Link href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                Categories
              </p>
              <div className="mt-4 space-y-3">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/blog/category/${category.slug}`}
                    className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    {category?.titleShort || category.title}
                  </Link>
                ))}
              </div>
            </div>

            <Link
              href="/dashboard"
              className="mt-auto rounded-2xl bg-white px-5 py-4 text-center text-sm font-semibold text-black"
            >
              Start Playing
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default HeaderBlog;
