"use client";

import { useEffect, useId, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";

const updates = [
  {
    title: "Case library doubled",
    body: "Playable cases increased from 150 to 300, giving players more disputes and courtroom situations to work through.",
  },
  {
    title: "Smarter client intake",
    body: "Clients now build a first-person memory from the case world instead of only echoing a canonical story. The facts still get checked against the case record in court.",
  },
  {
    title: "PVP challenges",
    body: "Players can challenge each other, prepare privately with their own AI client, and argue in court in a real-time-feeling flow that still works asynchronously.",
  },
  {
    title: "Bar Association",
    body: "Browse lawyers across the arena, inspect public dossiers, review records, and find opponents for the next challenge.",
  },
  {
    title: "Progression and leaderboards",
    body: "Ratings, XP, specialty boards, category progress, and player standing are now visible as you complete matters.",
  },
  {
    title: "Richer verdict feedback",
    body: "Rulings now show what helped your argument, what weakened it, and how your courtroom strategy performed.",
  },
];

const dialogTitle = "What's new in Legal Arena";

export default function WhatsNewDialog({ buttonLabel = dialogTitle }) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
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
                <h2
                  id={titleId}
                  className="arena-headline text-3xl uppercase leading-[0.95] text-white md:text-4xl"
                >
                  {dialogTitle}
                </h2>
                <p id={descriptionId} className="mt-3 max-w-xl text-sm leading-6 text-white/60">
                  The early-access build has grown into a deeper courtroom game with more
                  cases, better intake, PVP, and clearer player progression.
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
              {updates.map((update) => (
                <article
                  key={update.title}
                  className="rounded-xl border border-white/10 bg-white/[0.035] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-100/15 bg-amber-100/10 text-amber-100">
                      <HeroIcons.CheckIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">{update.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/62">{update.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="modal-action border-t border-white/10 bg-white/[0.02] px-5 py-4 md:px-6">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-sm rounded-2xl border-white/12 bg-white px-5 text-black hover:bg-white/90"
              >
                Done
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setIsOpen(false)}>
              close
            </button>
          </form>
        </dialog>
      ) : null}
    </>
  );
}
