"use client";

import Link from "next/link";
import { useEffect } from "react";
import { trackGoal } from "@/libs/datafast";

export default function AwardUnlockPanel({ changes = [], playerId = "" }) {
  useEffect(() => {
    changes.forEach((award) => trackGoal(
      award.type === "tier_upgraded" ? "award_tier_upgraded" : award.type === "occurrence" ? "award_occurrence_earned" : "award_unlocked",
      { award_code: award.code, tier: award.tier || "none", category: award.category || "", evaluation_source: award.evaluationSource || "objective" }
    ));
  }, [changes]);

  if (!changes.length) return null;
  return (
    <section className="arena-surface overflow-hidden border-amber-200/25" aria-live="polite" aria-label="Awards earned">
      <div className="bg-gradient-to-r from-amber-300/10 via-white/[0.025] to-transparent p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="arena-kicker">Career Record</p><h2 className="arena-headline mt-2 text-2xl">{changes.length === 1 ? "Award earned" : `${changes.length} awards earned`}</h2></div>
          {playerId ? <Link href={`/dashboard/players/${playerId}#awards`} className="arena-btn-light px-4 py-2 text-sm">View all awards</Link> : null}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {changes.map((award, index) => (
            <article key={`${award.code}-${award.type}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-4 motion-safe:animate-[fadeIn_.35s_ease-out]">
              <div className="flex gap-4"><span className="text-4xl" role="img" aria-label={`${award.name} award`}>{award.emoji}</span><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">{award.type === "tier_upgraded" ? `Upgraded to ${award.tier}` : award.type === "occurrence" ? "Distinction earned" : "New award"}</p><h3 className="mt-1 text-lg font-semibold text-white">{award.name}</h3><p className="mt-2 text-sm leading-6 text-white/62">{award.explanation || award.description}</p></div></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

