import Link from "next/link";
import Image from "next/image";
import config from "@/config";
import logo from "@/app/icon.png";

const Footer = () => {
  return (
    <footer className="border-t border-base-content/10 bg-base-200">
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
              <strong className="text-base font-extrabold tracking-tight md:text-lg">
                {config.appName}
              </strong>
            </Link>

            <p className="mt-3 text-sm text-base-content/80">
              Argue cases against AI in a courtroom battle of facts, law, and strategy.
            </p>
            <p className="mt-3 text-sm text-base-content/60">
              Copyright © {new Date().getFullYear()} {config.appName}. All rights reserved.
            </p>
          </div>

          <div className="flex flex-grow flex-wrap justify-center text-center">
            <div className="w-full px-4 md:w-1/2 lg:w-1/3">
              <div className="footer-title mb-3 text-sm font-semibold tracking-widest text-base-content md:text-left">
                LINKS
              </div>

              <div className="mb-10 flex flex-col items-center justify-center gap-2 text-sm md:items-start">
                <Link href="/tos" className="link link-hover">
                  Terms and Conditions
                </Link>
                <Link href="/privacy-policy" className="link link-hover">
                  Privacy Policy
                </Link>
                <a
                  href="mailto:divyanthj@gmail.com"
                  className="link link-hover"
                  aria-label="Contact Legal Arena"
                >
                  Contact us
                </a>
              </div>
            </div>

            <div className="w-full px-4 md:w-1/2 lg:w-1/3">
              <div className="footer-title mb-3 text-sm font-semibold tracking-widest text-base-content md:text-left">
                SOCIALS
              </div>

              <div className="mb-10 flex flex-col items-center justify-center gap-2 text-sm md:items-start">
                <a href="https://instagram.com" target="_blank" rel="noreferrer" className="link link-hover">
                  Instagram
                </a>
                <a href="https://x.com" target="_blank" rel="noreferrer" className="link link-hover">
                  X
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="link link-hover">
                  LinkedIn
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
