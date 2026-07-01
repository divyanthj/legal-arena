import Link from "next/link";
import Image from "next/image";
import config from "@/config";
import logo from "@/app/icon.png";

const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-black text-white">
      <div className="mx-auto max-w-7xl px-8 py-16">
        <div className="flex flex-col flex-wrap gap-10 md:flex-row md:flex-nowrap md:items-start">
          <div className="w-64 flex-shrink-0 text-center md:mx-0 md:text-left">
            <Link
              href="/"
              aria-current="page"
              className="flex items-center justify-center gap-2 md:justify-start"
            >
              <Image
                src={logo}
                alt={`${config.appName} logo`}
                priority
                className="h-6 w-6"
                width={24}
                height={24}
              />
              <strong className="text-base font-extrabold tracking-tight text-white md:text-lg">
                {config.appName}
              </strong>
            </Link>

            <p className="mt-3 text-sm text-white/70">
              Play an AI lawyer game where you interview clients, challenge players, and argue before an AI judge.
            </p>
            <p className="mt-3 text-sm text-white/40">
              Copyright © {new Date().getFullYear()} {config.appName}. All rights reserved.
            </p>
          </div>

          <div className="flex flex-grow flex-wrap justify-center text-center">
            <div className="w-full px-4 md:w-1/2 lg:w-1/3">
              <div className="footer-title mb-3 text-sm font-semibold tracking-widest text-white/50 md:text-left">
                LINKS
              </div>

              <div className="mb-10 flex flex-col items-center justify-center gap-2 text-sm md:items-start">
                <Link href="/blog" className="text-white/72 transition hover:text-white">
                  Blog
                </Link>
                <Link href="/faq" className="text-white/72 transition hover:text-white">
                  FAQ
                </Link>
                <Link href="/help" className="text-white/72 transition hover:text-white">
                  Tutorials
                </Link>
                <Link href="/tos" className="text-white/72 transition hover:text-white">
                  Terms and Conditions
                </Link>
                <Link
                  href="/privacy-policy"
                  className="text-white/72 transition hover:text-white"
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/contact"
                  className="text-white/72 transition hover:text-white"
                  aria-label="Contact Legal Arena"
                >
                  Contact us
                </Link>
              </div>
            </div>

            <div className="w-full px-4 md:w-1/2 lg:w-1/3">
              <div className="footer-title mb-3 text-sm font-semibold tracking-widest text-white/50 md:text-left">
                SOCIALS
              </div>

              <div className="mb-10 flex flex-col items-center justify-center gap-2 text-sm md:items-start">
                <a
                  href="https://instagram.com/legalarena.app"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/72 transition hover:text-white"
                >
                  Instagram
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
