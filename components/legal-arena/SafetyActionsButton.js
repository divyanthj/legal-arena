"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";

const categories = [
  ["offensive", "Offensive or hateful"],
  ["harassment", "Harassment or bullying"],
  ["sexual", "Sexual content"],
  ["violence", "Graphic violence"],
  ["self_harm", "Self-harm"],
  ["child_safety", "Child safety"],
  ["deception", "Deceptive or dangerous"],
  ["privacy", "Private information"],
  ["spam", "Spam or manipulation"],
  ["other", "Something else"],
];

export default function SafetyActionsButton({
  sourceType,
  sourceId,
  contextLabel,
  contentExcerpt = "",
  reportedPlayerId = "",
  reportedPlayerName = "the other player",
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("ai_content");
  const [category, setCategory] = useState("offensive");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const hasPlayer = Boolean(reportedPlayerId);

  const submitReport = async () => {
    setSubmitting(true);
    try {
      await apiClient.post("/reports", {
        sourceType,
        sourceId,
        reportType: mode,
        category,
        contextLabel,
        contentExcerpt,
        details,
        reportedPlayerId: hasPlayer && mode !== "ai_content" ? reportedPlayerId : "",
      });
      trackGoal("safety_report_submitted", {
        source_type: sourceType,
        report_type: mode,
        category,
      });
      toast.success("Report sent for review.");
      setOpen(false);
      setDetails("");
    } finally {
      setSubmitting(false);
    }
  };

  const blockPlayer = async () => {
    if (!hasPlayer) return;
    setSubmitting(true);
    try {
      await apiClient.post("/player-blocks", {
        blockedPlayerId: reportedPlayerId,
        reason: details,
      });
      trackGoal("player_blocked", { source_type: sourceType });
      toast.success(`${reportedPlayerName} is blocked from future challenges.`);
      setOpen(false);
      setDetails("");
    } finally {
      setSubmitting(false);
    }
  };

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-black/82 px-4 py-6 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="safety-actions-title"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close safety actions"
              onClick={() => setOpen(false)}
            />
            <section className="arena-surface relative w-full max-w-xl overflow-hidden">
              <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
                <div>
                  <p className="arena-kicker">Safety</p>
                  <h2 id="safety-actions-title" className="mt-2 text-2xl font-black text-white">
                    Report content or block a player
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/52">{contextLabel}</p>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/62"
                  onClick={() => setOpen(false)}
                >
                  <HeroIcons.XMarkIcon className="h-5 w-5" />
                </button>
              </header>

              <div className="max-h-[70dvh] overflow-y-auto p-5 md:p-6">
                <div className={`grid gap-2 ${hasPlayer ? "sm:grid-cols-3" : ""}`}>
                  {[
                    ["ai_content", "AI content"],
                    ...(hasPlayer
                      ? [
                          ["player_content", "Player content"],
                          ["player_conduct", "Player conduct"],
                        ]
                      : []),
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                        mode === value
                          ? "border-amber-200/40 bg-amber-200/10 text-amber-100"
                          : "border-white/10 bg-white/[0.025] text-white/58"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="mt-5 block">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-white/42">
                    What is wrong?
                  </span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="select arena-field mt-2 min-h-12 w-full text-white"
                  >
                    {categories.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-5 block">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-white/42">
                    Details
                  </span>
                  <textarea
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    maxLength={2000}
                    className="textarea arena-field mt-2 min-h-28 w-full text-white"
                    placeholder="Tell us what happened and where to look."
                  />
                </label>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitReport}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black disabled:opacity-60"
                >
                  {submitting ? <span className="loading loading-spinner loading-sm" /> : null}
                  Send report
                </button>

                {hasPlayer ? (
                  <div className="mt-5 border-t border-white/10 pt-5">
                    <p className="text-xs leading-5 text-white/45">
                      Blocking prevents new challenges in either direction. It does not
                      erase a PVP matter already in progress.
                    </p>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={blockPlayer}
                      className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200/25 bg-rose-500/10 px-4 text-sm font-bold text-rose-100"
                    >
                      <HeroIcons.NoSymbolIcon className="h-5 w-5" />
                      Block {reportedPlayerName}
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] text-white/55 transition hover:border-white/20 hover:text-white"
        aria-label="Report unsafe content"
        title="Report unsafe content"
      >
        <HeroIcons.FlagIcon className="h-4 w-4" aria-hidden="true" />
      </button>
      {modal}
    </>
  );
}

