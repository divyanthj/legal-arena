"use client";

import { useEffect, useId, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";
import { trackGoal } from "@/libs/datafast";

const updates = [
  {
    title: "A smoother settlement rhythm",
    body: "Consult your client, review a recommended response, and keep negotiations moving without writing every message from scratch. You can still edit any proposal when the stakes call for a personal touch.",
    icon: HeroIcons.ArrowsRightLeftIcon,
  },
  {
    title: "Clearer paths to agreement",
    body: "Settlement talks now focus on the adjustments that still matter, show how each side reacts, and surface a direct Accept Terms action when an offer is ready to close.",
    icon: HeroIcons.HandRaisedIcon,
  },
  {
    title: "Watch your next case take shape",
    body: "A new live case-assembly experience shows the matter, parties, dossier, and portraits coming together before client intake opens.",
    icon: HeroIcons.DocumentMagnifyingGlassIcon,
  },
  {
    title: "Seamless moves from conference to court",
    body: "Polished transitions now connect intake, settlement, and the courtroom, while each side's opening position is established before arguments begin.",
    icon: HeroIcons.ScaleIcon,
  },
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
        onClick={() => {
          trackGoal("landing_whats_new_opened", { source: "release_banner" });
          setIsOpen(true);
        }}
        className="btn btn-outline btn-block min-h-0 h-auto whitespace-nowrap rounded-2xl border-white/20 bg-black/35 px-5 py-3 text-sm text-white hover:border-white/35 hover:bg-white/10 hover:text-white"
      >
        <HeroIcons.SparklesIcon className="h-4 w-4" aria-hidden="true" />
        {buttonLabel}
      </button>

      {isOpen ? (
        <dialog className="arena-modal modal modal-open text-white">
          <div
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="modal-box flex max-h-[88vh] max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#090b0f] p-0 text-white shadow-2xl shadow-black/80"
          >
            <header className="relative flex shrink-0 items-start justify-between gap-5 overflow-hidden border-b border-white/10 bg-gradient-to-br from-white/[0.07] via-transparent to-amber-300/[0.07] p-5 md:p-7">
              <div className="pointer-events-none absolute -right-16 -top-24 h-60 w-60 rounded-full bg-amber-300/10 blur-3xl" aria-hidden="true" />
              <div className="relative min-w-0">
                <div className="flex items-center gap-2 text-amber-100/80">
                  <HeroIcons.SparklesIcon className="h-4 w-4" aria-hidden="true" />
                  <p className="text-xs font-bold uppercase tracking-[0.22em]">Latest from the arena</p>
                </div>
                <h2 id={titleId} className="arena-headline mt-3 text-3xl uppercase leading-[0.95] text-white md:text-4xl">
                  {dialogTitle}
                </h2>
                <p id={descriptionId} className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                  Settle matters with less friction, follow every case as it takes
                  shape, and move smoothly from client conference to courtroom—plus
                  discover the latest career and case-building improvements.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="arena-modal-close btn btn-circle btn-ghost btn-sm relative shrink-0 border border-white/10 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10 hover:text-white"
                aria-label="Close what's new dialog"
              >
                <HeroIcons.XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="arena-scroll grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain p-5 md:grid-cols-2 md:p-6">
              {updates.map((update, index) => {
                const Icon = update.icon;
                return (
                  <article
                    key={update.title}
                    className="arena-modal-card-enter group rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.025] p-4 shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-0.5 hover:border-amber-100/20 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-black/25"
                    style={{ animationDelay: `${Math.min(index * 45, 315)}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-100/15 bg-amber-100/10 text-amber-100 shadow-inner shadow-amber-100/5 transition duration-300 group-hover:scale-105 group-hover:border-amber-100/30 group-hover:bg-amber-100/15">
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

            <div className="modal-action shrink-0 border-t border-white/10 bg-gradient-to-r from-white/[0.025] via-white/[0.045] to-amber-200/[0.035] px-5 py-4 md:px-6">
              <button type="button" onClick={() => setIsOpen(false)} className="btn btn-sm rounded-2xl border-white/12 bg-white px-6 text-black shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:bg-amber-50">
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
