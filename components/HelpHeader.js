"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ButtonSignin from "./ButtonSignin";
import logo from "@/app/icon.png";
import config from "@/config";

const cta = <ButtonSignin extraStyle="arena-btn-light px-4 py-2 text-sm" />;

export default function HelpHeader({ links }) {
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [searchParams]);

  return (
    <header className="arena-app-shell border-b border-white/10">
      <nav
        className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4 md:px-8"
        aria-label="Global"
      >
        <div className="flex items-center gap-3">
          <Link
            className="flex shrink-0 items-center gap-3"
            href="/"
            title={`${config.appName} homepage`}
          >
            <Image
              src={logo}
              alt={`${config.appName} logo`}
              className="w-8 rounded-full"
              placeholder="blur"
              priority
              width={32}
              height={32}
            />
            <div>
              <p className="arena-kicker">Help Center</p>
              <span className="text-lg font-extrabold text-white">{config.appName}</span>
            </div>
          </Link>
        </div>

        <div className="hidden lg:flex lg:items-center lg:gap-3">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="arena-btn-dark inline-flex px-4 py-2 text-sm"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex">{cta}</div>

        <div className="flex lg:hidden">
          <button
            type="button"
            className="arena-btn-dark inline-flex px-3 py-2"
            onClick={() => setIsOpen(true)}
          >
            Menu
          </button>
        </div>
      </nav>

      <div className={`relative z-50 ${isOpen ? "" : "hidden"}`}>
        <div className="fixed inset-y-0 right-0 z-10 w-full origin-right overflow-y-auto border-l border-white/10 bg-[#050505] px-6 py-6 transition duration-300 ease-in-out sm:max-w-sm">
          <div className="flex items-center justify-between">
            <Link
              className="flex shrink-0 items-center gap-3"
              title={`${config.appName} homepage`}
              href="/"
            >
              <Image
                src={logo}
                alt={`${config.appName} logo`}
                className="w-8 rounded-full"
                placeholder="blur"
                priority
                width={32}
                height={32}
              />
              <span className="text-lg font-extrabold text-white">{config.appName}</span>
            </Link>
            <button
              type="button"
              className="arena-btn-dark inline-flex px-3 py-2"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="mt-8 space-y-3">
            {links.map((link) => (
              <a
                href={link.href}
                key={link.href}
                className="arena-surface-soft block px-4 py-3 text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="mt-8">{cta}</div>
        </div>
      </div>
    </header>
  );
}
