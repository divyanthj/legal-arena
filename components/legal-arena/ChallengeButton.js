"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";
import { useNavigationLoading } from "@/components/NavigationLoadingProvider";

const formatCategoryLabel = (value = "") =>
  String(value || "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function ChallengeButton({
  targetPlayerId,
  targetPlayerName = "this player",
  templates = [],
  hasArenaAccess = false,
  className = "arena-btn-light px-4 py-2 text-sm",
  label = "Challenge",
  onNeedsAccess,
}) {
  const router = useRouter();
  const { startNavigationLoading } = useNavigationLoading();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const unlockedTemplates = useMemo(
    () => templates.filter((template) => template.unlocked),
    [templates]
  );
  const categoryOptions = useMemo(() => {
    const categories = [
      ...new Set(unlockedTemplates.map((template) => template.primaryCategory).filter(Boolean)),
    ];

    return categories.map((slug) => ({
      slug,
      label: formatCategoryLabel(slug),
    }));
  }, [unlockedTemplates]);
  const visibleTemplates = useMemo(
    () =>
      selectedCategory === "all"
        ? unlockedTemplates
        : unlockedTemplates.filter(
            (template) => template.primaryCategory === selectedCategory
          ),
    [selectedCategory, unlockedTemplates]
  );
  const activeTemplate =
    visibleTemplates.length > 0
      ? visibleTemplates[Math.min(activeTemplateIndex, visibleTemplates.length - 1)]
      : null;
  const selectedTemplateId = activeTemplate?.id || "";
  const canNavigateTemplates = visibleTemplates.length > 1;

  const startChallenge = () => {
    if (!hasArenaAccess) {
      if (onNeedsAccess) {
        onNeedsAccess();
      } else {
        toast.error("Purchase access to sponsor a challenge.");
      }
      return;
    }

    if (!unlockedTemplates.length) {
      toast.error("Unlock a case before sending a challenge.");
      return;
    }

    setActiveTemplateIndex((current) =>
      unlockedTemplates[current] ? current : 0
    );
    setOpen(true);
  };

  const createChallenge = async () => {
    if (!selectedTemplateId || creating) {
      return;
    }

    setCreating(true);
    try {
      const response = await apiClient.post("/challenges", {
        challengedId: targetPlayerId,
        caseTemplateId: selectedTemplateId,
      });
      const challenge = response.challenge;
      toast.success("Challenge sent.");
      setOpen(false);
      startNavigationLoading("Opening challenge");
      const challengeHref = `/dashboard/challenges/${challenge.slug || challenge.id}`;
      router.prefetch(challengeHref);
      router.push(challengeHref);
    } catch (error) {
      toast.error(error?.message || "Could not create challenge.");
    } finally {
      setCreating(false);
    }
  };

  const goToPreviousTemplate = () => {
    if (!canNavigateTemplates) return;
    setActiveTemplateIndex((current) =>
      current === 0 ? visibleTemplates.length - 1 : current - 1
    );
  };

  const goToNextTemplate = () => {
    if (!canNavigateTemplates) return;
    setActiveTemplateIndex((current) =>
      current >= visibleTemplates.length - 1 ? 0 : current + 1
    );
  };

  const chooseCategory = (categorySlug) => {
    setSelectedCategory(categorySlug);
    setActiveTemplateIndex(0);
  };

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] flex min-h-[100dvh] items-start justify-center overflow-y-auto bg-black/82 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-6 md:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="challenge-dialog-title"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close challenge dialog"
              disabled={creating}
              onClick={() => setOpen(false)}
            />
            <div className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-[#101010] shadow-[0_30px_120px_rgba(0,0,0,0.78),0_0_0_1px_rgba(255,255,255,0.055)] sm:max-h-[calc(100dvh-3rem)]">
              <div className="shrink-0 bg-white/[0.025] px-5 py-5 md:px-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="arena-kicker text-white">Choose a Case</p>
                    <h3
                      id="challenge-dialog-title"
                      className="mt-2 text-2xl font-semibold leading-tight text-white md:text-3xl"
                    >
                      Challenge {targetPlayerName}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="arena-btn-dark min-h-0 shrink-0 px-4 py-2 text-sm"
                    disabled={creating}
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="arena-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5 md:px-7 md:pb-7">
                <div className="min-w-0 space-y-5">
                  <div>
                    <p className="arena-kicker text-white">Case Type</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          selectedCategory === "all"
                            ? "border-white bg-white text-black"
                            : "border-white/12 bg-white/[0.035] text-white hover:border-white/28"
                        }`}
                        disabled={creating}
                        onClick={() => chooseCategory("all")}
                      >
                        All
                      </button>
                      {categoryOptions.map((category) => (
                        <button
                          key={category.slug}
                          type="button"
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            selectedCategory === category.slug
                              ? "border-white bg-white text-black"
                              : "border-white/12 bg-white/[0.035] text-white hover:border-white/28"
                          }`}
                          disabled={creating}
                          onClick={() => chooseCategory(category.slug)}
                        >
                          {category.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeTemplate ? (
                    <div className="rounded-lg bg-white/[0.035] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] md:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="arena-kicker">Case</p>
                          <p className="mt-2 text-sm text-white">
                            {Math.min(activeTemplateIndex + 1, visibleTemplates.length)} /{" "}
                            {visibleTemplates.length} unlocked matters
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="arena-btn-dark min-h-0 px-3 py-2"
                            onClick={goToPreviousTemplate}
                            disabled={!canNavigateTemplates || creating}
                            aria-label="Show previous case"
                          >
                            &lt;
                          </button>
                          <button
                            type="button"
                            className="arena-btn-dark min-h-0 px-3 py-2"
                            onClick={goToNextTemplate}
                            disabled={!canNavigateTemplates || creating}
                            aria-label="Show next case"
                          >
                            &gt;
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge badge-outline border-white/20 text-white">
                              {activeTemplate.practiceArea}
                            </span>
                            <span className="badge badge-outline border-white/20 text-white">
                              {activeTemplate.primaryCategory}
                            </span>
                            <span className="badge border arena-status arena-status-favorable">
                              Ready
                            </span>
                          </div>
                          <h4 className="mt-4 text-2xl font-semibold leading-tight text-white">
                            {activeTemplate.title}
                          </h4>
                          <p className="mt-3 line-clamp-4 text-sm leading-7 text-white">
                            {activeTemplate.overview}
                          </p>
                        </div>

                        <div className="rounded-lg bg-black/24 p-4 text-sm">
                          <div>
                            <p className="arena-kicker">Court</p>
                            <p className="mt-2 font-semibold text-white">
                              {activeTemplate.courtName || "Arena Court"}
                            </p>
                          </div>
                          <div className="mt-4">
                            <p className="arena-kicker">Complexity</p>
                            <p className="mt-2 font-semibold text-white">
                              Tier {activeTemplate.complexity}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="arena-kicker">Plaintiff</p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {activeTemplate.plaintiffName || activeTemplate.clientName}
                          </p>
                        </div>
                        <div>
                          <p className="arena-kicker">Defendant</p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {activeTemplate.defendantName || activeTemplate.opponentName}
                          </p>
                        </div>
                      </div>

                      {canNavigateTemplates ? (
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                          {visibleTemplates.map((template, index) => (
                            <button
                              key={`challenge-case-dot-${template.id}`}
                              type="button"
                              className={`h-2.5 rounded-full transition ${
                                index === activeTemplateIndex
                                  ? "w-8 bg-white"
                                  : "w-2.5 bg-white/22 hover:bg-white/45"
                              }`}
                              onClick={() => setActiveTemplateIndex(index)}
                              disabled={creating}
                              aria-label={`Show challenge case ${index + 1}`}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 border-t border-white/10 bg-black/70 px-5 py-4 backdrop-blur-md md:px-7">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="arena-btn-dark px-5 py-3"
                  disabled={creating}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="arena-btn-light px-5 py-3"
                  disabled={creating || !activeTemplate}
                  onClick={createChallenge}
                >
                  {creating ? "Creating invite..." : "Send Challenge"}
                </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button type="button" className={className} onClick={startChallenge}>
        {label}
      </button>
      {modal}
    </>
  );
}
