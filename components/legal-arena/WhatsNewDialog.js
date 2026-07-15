"use client";

import { useEffect, useId, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";

const updates = [
  {
    title: "Awards, distinctions, and lawyer titles",
    body: "Every completed matter can now unlock career honours, repeatable tiered distinctions, rare feats, and selectable lawyer titles. Your dossier shows only what you have earned.",
    icon: HeroIcons.TrophyIcon,
  },
  {
    title: "Country counsel awards",
    body: "Win in any supported country to earn its own Counsel distinction. Return to the same jurisdiction to advance from Bronze through Diamond.",
    icon: HeroIcons.GlobeAltIcon,
  },
  {
    title: "Cases shaped by country",
    body: "Choose from 249 countries before a solo matter or PVP challenge. New cases reflect the selected country's names, setting, currency, institutions, and social context.",
    icon: HeroIcons.MapPinIcon,
  },
  {
    title: "A clearer career dossier",
    body: "The collapsible Awards section highlights recent wins at a glance, with category filters, tier progress, rarity, occurrence counts, and detailed award records when expanded.",
    icon: HeroIcons.IdentificationIcon,
  },
  {
    title: "Better settlement judgment",
    body: "Clients now respond more intelligently to the latest offer, helping you test authority, acceptable ranges, and conditions before accepting or countering.",
    icon: HeroIcons.ChatBubbleLeftRightIcon,
  },
  {
    title: "Fairer difficulty and richer clients",
    body: "Case pressure now aligns more consistently with the selected difficulty, while client portraits and personalities have greater variety across matters.",
    icon: HeroIcons.AdjustmentsHorizontalIcon,
  },
  {
    title: "Publish completed case reports",
    body: "Turn eligible verdicts into public, search-friendly reports featuring the matter, your advocacy, category, result, and lawyer profile.",
    icon: HeroIcons.NewspaperIcon,
  },
  {
    title: "Awards after the result",
    body: "Verdict and settlement screens now announce first unlocks, repeat distinctions, and tier upgrades immediately, with semantic awards arriving after evaluation.",
    icon: HeroIcons.SparklesIcon,
  },
];

const dialogTitle = "What's new in Legal Arena";

export default function WhatsNewDialog({ buttonLabel = dialogTitle }) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn btn-outline btn-block min-h-0 h-auto whitespace-nowrap rounded-2xl border-white/20 bg-black/35 px-5 py-3 text-sm text-white hover:border-white/35 hover:bg-white/10 hover:text-white"
      >
        <HeroIcons.SparklesIcon className="h-4 w-4" aria-hidden="true" />
        {buttonLabel}
      </button>

      {isOpen ? (
        <dialog className="modal modal-open">
          <div
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="modal-box max-h-[86vh] max-w-3xl rounded-2xl border border-amber-100/10 bg-[#0b0b0b] p-0 text-white shadow-2xl shadow-black/60"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.035] p-5 md:p-6">
              <div>
                <h2 id={titleId} className="arena-headline text-3xl uppercase leading-[0.95] text-white md:text-4xl">
                  {dialogTitle}
                </h2>
                <p id={descriptionId} className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                  A new career layer has arrived alongside country-shaped cases,
                  smarter settlement decisions, improved difficulty balance, richer
                  client variety, and publishable case reports.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-circle btn-ghost btn-sm shrink-0 text-white/72"
                aria-label="Close what's new dialog"
              >
                <HeroIcons.XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-2 md:p-6">
              {updates.map((update) => {
                const Icon = update.icon;
                return (
                  <article key={update.title} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-100/15 bg-amber-100/10 text-amber-100">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-white">{update.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/62">{update.body}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="modal-action border-t border-white/10 bg-white/[0.02] px-5 py-4 md:px-6">
              <button type="button" onClick={() => setIsOpen(false)} className="btn btn-sm rounded-2xl border-white/12 bg-white px-5 text-black hover:bg-white/90">
                Done
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setIsOpen(false)}>close</button>
          </form>
        </dialog>
      ) : null}
    </>
  );
}
