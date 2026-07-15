"use client";

import { useEffect, useMemo, useState } from "react";
import * as HeroIcons from "@heroicons/react/24/outline";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";

const tierRank = { diamond: 4, gold: 3, silver: 2, bronze: 1, null: 0 };
const tierClasses = {
  bronze: "border-orange-300/30 bg-orange-300/[0.055]",
  silver: "border-slate-200/30 bg-slate-200/[0.055]",
  gold: "border-amber-200/40 bg-amber-200/[0.07]",
  diamond: "border-cyan-200/40 bg-cyan-200/[0.07]",
};
const label = (value = "") =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AwardsMatrix({ data, owner = false }) {
  const [expanded, setExpanded] = useState(true);
  const [tier, setTier] = useState("all");
  const [category, setCategory] = useState("all");
  const [repeatable, setRepeatable] = useState("all");
  const [sort, setSort] = useState("catalogue");
  const [selected, setSelected] = useState(null);
  const [titleCode, setTitleCode] = useState(data?.summary?.selectedTitle?.code || "");
  const awards = useMemo(
    () => (data?.awards || []).filter((award) => award.unlocked),
    [data?.awards]
  );
  const categories = useMemo(
    () => [...new Set(awards.map((award) => award.category))],
    [awards]
  );
  const compactAwards = useMemo(
    () => [...awards]
      .sort((left, right) => new Date(right.lastEarnedAt || 0) - new Date(left.lastEarnedAt || 0))
      .slice(0, 4),
    [awards]
  );

  useEffect(() => {
    trackGoal("awards_profile_viewed", { profile: owner ? "private" : "public" });
  }, [owner]);

  const filtered = useMemo(() => {
    const result = awards.filter(
      (award) =>
        (tier === "all" || award.highestTier === tier) &&
        (category === "all" || award.category === category) &&
        (repeatable === "all" || (repeatable === "yes") === award.repeatable)
    );
    return result.sort((left, right) => {
      if (sort === "recent") return new Date(right.lastEarnedAt || 0) - new Date(left.lastEarnedAt || 0);
      if (sort === "rarest") return (left.rarity?.percentage ?? 101) - (right.rarity?.percentage ?? 101);
      if (sort === "tier") return (tierRank[right.highestTier] || 0) - (tierRank[left.highestTier] || 0);
      if (sort === "earned") return right.occurrenceCount - left.occurrenceCount;
      if (sort === "closest") return (left.nextTier?.remaining ?? Infinity) - (right.nextTier?.remaining ?? Infinity);
      return awards.indexOf(left) - awards.indexOf(right);
    });
  }, [awards, category, repeatable, sort, tier]);

  const updateFilter = (setter, name) => (event) => {
    setter(event.target.value);
    trackGoal("award_filter_used", { filter: name, value: event.target.value });
  };
  const selectTitle = async (event) => {
    const next = event.target.value;
    setTitleCode(next);
    await apiClient.patch("/players/lawyer-title", { titleCode: next || null });
    trackGoal("lawyer_title_selected", { title_code: next || "none" });
  };
  const openDetail = (award) => {
    setSelected(award);
    trackGoal("award_detail_viewed", {
      award_code: award.code,
      tier: award.highestTier || "unranked",
      category: award.category,
    });
  };

  if (!data) return null;
  const summary = data.summary || {};

  return (
    <section id="awards" className="arena-surface scroll-mt-24 overflow-hidden">
      <button
        type="button"
        className="block w-full p-5 text-left transition hover:bg-white/[0.018] md:p-6"
        aria-expanded={expanded}
        aria-controls="awards-expanded-content"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="arena-kicker">Career Record</p>
            <h2 className="arena-headline mt-2 text-3xl">Awards</h2>
            <p className="mt-2 text-sm text-white/55">
              {awards.length
                ? `${awards.length} award${awards.length === 1 ? "" : "s"} earned across the arena.`
                : "Your earned honours and distinctions will appear here."}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/62">
            {expanded ? "Collapse awards" : "View all awards"}
            <HeroIcons.ChevronDownIcon
              className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {compactAwards.map((award) => (
            <span
              key={`compact-${award.code}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white/72"
            >
              <span role="img" aria-hidden="true">{award.emoji}</span>
              <span>{award.name}</span>
              {award.highestTier ? <span className="text-white/40">· {label(award.highestTier)}</span> : null}
            </span>
          ))}
          {!compactAwards.length ? (
            <span className="text-xs text-white/42">No awards earned yet.</span>
          ) : null}
          {awards.length > compactAwards.length ? (
            <span className="text-xs font-semibold text-amber-200/75">
              +{awards.length - compactAwards.length} more
            </span>
          ) : null}
        </div>
      </button>

      {expanded ? (
        <div id="awards-expanded-content" className="border-t border-white/8 px-5 pb-5 pt-5 md:px-6 md:pb-6">
          <div className="flex justify-end">
            {owner && data.titles?.length ? (
              <label className="text-sm text-white/62">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em]">Display title</span>
                <select className="arena-select select select-bordered min-h-0" value={titleCode} onChange={selectTitle}>
                  <option value="">No title</option>
                  {data.titles.map((title) => <option key={title.code} value={title.code}>{title.emoji} {title.name}</option>)}
                </select>
              </label>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {[
              ["Unique", summary.uniqueAwards],
              ["Occurrences", summary.totalOccurrences],
              ["Gold +", summary.highestTierAwards],
              ["Current streak", summary.currentWinStreak],
              ["Best streak", summary.longestWinStreak],
              ["Practice", summary.strongestPracticeArea ? label(summary.strongestPracticeArea) : "Building"],
            ].map(([name, value]) => (
              <div key={name} className="arena-stat-card !p-4">
                <p className="arena-kicker">{name}</p>
                <p className="mt-2 text-xl font-semibold text-white">{value ?? 0}</p>
              </div>
            ))}
          </div>

          {awards.length ? (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <select aria-label="Award tier filter" className="arena-select select select-bordered min-h-0" value={tier} onChange={updateFilter(setTier, "tier")}>
                  <option value="all">All tiers</option>
                  {["bronze", "silver", "gold", "diamond"].map((item) => <option key={item} value={item}>{label(item)}</option>)}
                </select>
                <select aria-label="Award category filter" className="arena-select select select-bordered min-h-0" value={category} onChange={updateFilter(setCategory, "category")}>
                  <option value="all">All categories</option>
                  {categories.map((item) => <option key={item} value={item}>{label(item)}</option>)}
                </select>
                <select aria-label="Repeatable award filter" className="arena-select select select-bordered min-h-0" value={repeatable} onChange={updateFilter(setRepeatable, "repeatable")}>
                  <option value="all">Any frequency</option><option value="yes">Repeatable</option><option value="no">One-time</option>
                </select>
                <select aria-label="Award sorting" className="arena-select select select-bordered min-h-0" value={sort} onChange={updateFilter(setSort, "sort")}>
                  <option value="catalogue">Catalogue order</option><option value="recent">Recently earned</option><option value="rarest">Rarest</option><option value="tier">Highest tier</option><option value="earned">Most earned</option><option value="closest">Closest upgrade</option>
                </select>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filtered.map((award) => (
                  <button
                    key={award.code}
                    type="button"
                    onClick={() => openDetail(award)}
                    aria-label={`${award.name}, unlocked ${award.highestTier || ""}`}
                    className={`relative min-h-[10.5rem] rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-200/70 ${tierClasses[award.highestTier] || "border-amber-200/20 bg-white/[0.04]"}`}
                  >
                    <span className="text-4xl" role="img" aria-hidden="true">{award.emoji}</span>
                    <h3 className="mt-3 font-semibold leading-tight text-white">{award.name}</h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-white/45">
                      {label(award.category)}{award.highestTier ? ` · ${label(award.highestTier)}` : ""}
                    </p>
                    {award.repeatable && award.occurrenceCount ? <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-xs font-semibold text-white">×{award.occurrenceCount}</span> : null}
                    {award.nextTier?.nextTier ? <p className="mt-3 text-xs text-white/48">{award.nextTier.remaining} to {label(award.nextTier.nextTier)}</p> : null}
                  </button>
                ))}
              </div>
              {!filtered.length ? <p className="mt-6 rounded-2xl border border-white/8 p-5 text-sm text-white/52">No earned awards match these filters.</p> : null}
            </>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/15 p-8 text-center">
              <p className="font-semibold text-white">No awards earned yet</p>
              <p className="mt-2 text-sm text-white/52">Complete matters to begin building this career record.</p>
            </div>
          )}
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="award-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="arena-surface max-h-[85vh] w-full max-w-xl overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-4"><span className="text-5xl" role="img" aria-label={`${selected.name} award`}>{selected.emoji}</span><button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white" onClick={() => setSelected(null)} aria-label="Close award details">Close</button></div>
            <h3 id="award-dialog-title" className="mt-4 text-2xl font-semibold text-white">{selected.name}</h3>
            <p className="mt-3 leading-7 text-white/65">{selected.description}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="arena-surface-soft p-3"><dt className="text-white/45">Status</dt><dd className="mt-1 font-semibold text-white">Unlocked{selected.highestTier ? ` · ${label(selected.highestTier)}` : ""}</dd></div>
              <div className="arena-surface-soft p-3"><dt className="text-white/45">Times earned</dt><dd className="mt-1 font-semibold text-white">{selected.occurrenceCount}</dd></div>
              <div className="arena-surface-soft p-3"><dt className="text-white/45">First earned</dt><dd className="mt-1 font-semibold text-white">{new Date(selected.firstUnlockedAt).toLocaleDateString()}</dd></div>
              <div className="arena-surface-soft p-3"><dt className="text-white/45">Rarity</dt><dd className="mt-1 font-semibold text-white">{selected.rarity?.percentage == null ? "Not enough data" : `${selected.rarity.percentage}% · ${selected.rarity.band}`}</dd></div>
            </dl>
            {selected.tierThresholds ? <div className="mt-5"><p className="text-sm font-semibold text-white">Tier thresholds</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(selected.tierThresholds).map(([name, threshold]) => <span key={name} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/62">{label(name)} · {threshold}</span>)}</div></div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

