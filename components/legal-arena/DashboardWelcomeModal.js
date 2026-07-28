"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import * as HeroIcons from "@heroicons/react/24/outline";
import { trackGoal } from "@/libs/datafast";

export const dashboardWelcomeSlides = [
  {
    id: "welcome",
    number: "01",
    eyebrow: "Welcome to Legal Arena",
    title: "Welcome to the courtroom.",
    body: "Legal Arena is an AI-powered courtroom game where every question and argument shapes the outcome. Interview your client, build the facts, negotiate, or make your case before the judge.",
    detail: "Here’s how it works",
    image: "/images/court.jpg",
    imageAlt: "A courtroom prepared for a Legal Arena case",
    imageWidth: 792,
    imageHeight: 972,
    visual: "intro",
  },
  {
    id: "choose",
    number: "02",
    eyebrow: "Step 1 · Choose your case",
    title: "Choose a case.",
    body: "Start in the case library. Choose a practice area and difficulty, then select the dispute you want to handle.",
    detail: "Case library",
    image: "/help/screenshots/case-selection.png",
    imageAlt: "Legal Arena case library showing practice areas and difficulty choices",
    imageWidth: 1265,
    imageHeight: 712,
    visual: "single",
  },
  {
    id: "build",
    number: "03",
    eyebrow: "Step 2 · Interview your client",
    title: "Interview your client.",
    body: "Ask focused questions to uncover what happened. Your fact sheet updates automatically and becomes the source of truth for your case.",
    detail: "Intake · Fact sheet",
    image: "/media/tutorials/case-intake.png",
    imageAlt: "Legal Arena client intake interview and case-building workspace",
    imageWidth: 584,
    imageHeight: 5239,
    visual: "intake",
  },
  {
    id: "resolve",
    number: "04",
    eyebrow: "Step 3 · Choose your strategy",
    title: "Settle or go to court.",
    body: "Once the facts are clear, choose your strategy. Negotiate with opposing counsel or take the dispute to court and argue before the judge.",
    detail: "Happy lawyering!",
    image: "/help/screenshots/courtroom.png",
    imageAlt: "Legal Arena courtroom showing the parties, judge signal, and case status",
    imageWidth: 1265,
    imageHeight: 712,
    secondaryImage: "/help/screenshots/settlement.png",
    secondaryImageAlt: "Legal Arena settlement negotiation composer",
    visual: "layered",
  },
];

const EXIT_DURATION_MS = 260;
const SWIPE_THRESHOLD_PX = 52;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export default function DashboardWelcomeModal({
  isOpen,
  source = "automatic_dashboard",
  initialSlide = 0,
  doNotShowAgainInitially = false,
  analyticsEnabled = true,
  onStartTour,
  onSkip,
}) {
  const dialogRef = useRef(null);
  const primaryActionRef = useRef(null);
  const touchStartXRef = useRef(null);
  const viewedSlidesRef = useRef(new Set());
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialSlide);
  const [direction, setDirection] = useState("forward");
  const [leaving, setLeaving] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [doNotShowAgain, setDoNotShowAgain] = useState(
    Boolean(doNotShowAgainInitially)
  );
  const slide = dashboardWelcomeSlides[activeIndex] || dashboardWelcomeSlides[0];
  const isReplay = !source.startsWith("automatic_");

  const emit = useCallback(
    (goal, extra = {}) => {
      if (!analyticsEnabled) return;
      trackGoal(goal, {
        source,
        replay: isReplay,
        slide_id: slide?.id || "",
        slide_index: activeIndex + 1,
        slide_count: dashboardWelcomeSlides.length,
        ...extra,
      });
    },
    [activeIndex, analyticsEnabled, isReplay, slide?.id, source]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      setActiveIndex(
        Math.max(0, Math.min(dashboardWelcomeSlides.length - 1, initialSlide))
      );
      setDirection("forward");
      setLeaving(false);
      setPendingAction("");
      setActionError("");
      setDoNotShowAgain(Boolean(doNotShowAgainInitially));
      viewedSlidesRef.current = new Set();
      dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      window.requestAnimationFrame(() => primaryActionRef.current?.focus());
      if (analyticsEnabled) {
        trackGoal("dashboard_welcome_viewed", {
          source,
          replay: isReplay,
          entry_kind: isReplay ? "replay" : "first_visit",
          slide_id:
            dashboardWelcomeSlides[
              Math.max(
                0,
                Math.min(dashboardWelcomeSlides.length - 1, initialSlide)
              )
            ]?.id || "choose",
          slide_index: initialSlide + 1,
          slide_count: dashboardWelcomeSlides.length,
        });
      }

      return () => {
        document.body.style.overflow = previousOverflow;
        if (dialog.open) dialog.close();
      };
    }

    if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [
    analyticsEnabled,
    doNotShowAgainInitially,
    initialSlide,
    isOpen,
    isReplay,
    mounted,
    source,
  ]);

  useEffect(() => {
    if (!isOpen || viewedSlidesRef.current.has(slide.id)) return;
    viewedSlidesRef.current.add(slide.id);
    emit("dashboard_welcome_slide_viewed");
  }, [emit, isOpen, slide.id]);

  const selectSlide = useCallback(
    (nextIndex, method = "button") => {
      const clampedIndex = Math.max(
        0,
        Math.min(dashboardWelcomeSlides.length - 1, nextIndex)
      );
      if (clampedIndex === activeIndex || pendingAction) return;

      const nextDirection = clampedIndex > activeIndex ? "forward" : "backward";
      emit("dashboard_welcome_slide_changed", {
        method,
        direction: nextDirection,
        destination_slide_id: dashboardWelcomeSlides[clampedIndex].id,
        destination_slide_index: clampedIndex + 1,
      });
      setDirection(nextDirection);
      setActiveIndex(clampedIndex);
    },
    [activeIndex, emit, pendingAction]
  );

  const runDeparture = useCallback(
    async (action, callback) => {
      if (pendingAction) return;

      setActionError("");
      setPendingAction(action);
      setLeaving(true);

      if (!prefersReducedMotion()) {
        await new Promise((resolve) => window.setTimeout(resolve, EXIT_DURATION_MS));
      }

      try {
        await callback?.();
      } catch (error) {
        emit("dashboard_welcome_action_failed", {
          action,
          error_message: error?.message || "unknown",
        });
        setActionError(
          error?.message || "Couldn’t save. Try again."
        );
        setLeaving(false);
        setPendingAction("");
        window.requestAnimationFrame(() => primaryActionRef.current?.focus());
      }
    },
    [emit, pendingAction]
  );

  const startTour = (method = "primary_cta") => {
    if (pendingAction) return;

    if (
      method === "final_next" ||
      method === "keyboard_final_next"
    ) {
      emit("dashboard_welcome_completed", {
        method,
        do_not_show_again: doNotShowAgain,
      });
    }
    emit("dashboard_welcome_tour_started", {
      method,
      do_not_show_again: doNotShowAgain,
    });
    runDeparture("tour", () => onStartTour?.({ doNotShowAgain }));
  };

  const skipWelcome = (method = "top_skip") => {
    if (pendingAction) return;

    if (method === "direct_play") {
      emit("dashboard_welcome_direct_play_started", {
        method,
        do_not_show_again: doNotShowAgain,
      });
    }
    emit("dashboard_welcome_skipped", {
      method,
      do_not_show_again: doNotShowAgain,
    });
    runDeparture("skip", () => onSkip?.({ doNotShowAgain }));
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (activeIndex === dashboardWelcomeSlides.length - 1) {
        startTour("keyboard_final_next");
      } else {
        selectSlide(activeIndex + 1, "keyboard");
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectSlide(activeIndex - 1, "keyboard");
    } else if (event.key === "Home") {
      event.preventDefault();
      selectSlide(0, "keyboard");
    } else if (event.key === "End") {
      event.preventDefault();
      selectSlide(dashboardWelcomeSlides.length - 1, "keyboard");
    }
  };

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    if (touchStartXRef.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const delta = endX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    selectSlide(activeIndex + (delta < 0 ? 1 : -1), "swipe");
  };

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="arena-welcome-dialog m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden border-0 bg-[#050505] p-0 text-white backdrop:bg-black/92"
      aria-labelledby="dashboard-welcome-title"
      aria-describedby="dashboard-welcome-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pendingAction) skipWelcome("escape");
      }}
      onKeyDown={handleKeyDown}
      data-welcome-slide={slide.id}
      data-welcome-leaving={leaving ? "true" : "false"}
    >
      <div
        className={`arena-welcome-shell relative min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#050505] ${
          leaving ? "arena-welcome-shell-leaving" : ""
        }`}
      >
        <Image
          src="/images/court.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="pointer-events-none fixed inset-0 h-full w-full scale-105 object-cover opacity-[0.16]"
        />
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_78%_24%,rgba(251,191,36,0.14),transparent_28%),radial-gradient(circle_at_14%_82%,rgba(52,211,153,0.08),transparent_26%),linear-gradient(110deg,rgba(0,0,0,0.98)_4%,rgba(7,7,7,0.9)_48%,rgba(0,0,0,0.82)_100%)]" />
        <div className="arena-welcome-grid pointer-events-none fixed inset-0 opacity-30" />

        <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col px-4 pb-5 pt-4 sm:px-6 sm:pb-7 sm:pt-6 lg:px-10 lg:pb-10 lg:pt-8">
          <header className="flex items-center justify-between gap-4">
            <Image
              src="/logoAndName.png"
              alt="Legal Arena"
              width={600}
              height={600}
              priority
              className="h-12 w-12 rounded-xl object-contain sm:h-14 sm:w-14"
            />
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/46 transition hover:bg-white/[0.05] hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              onClick={() => skipWelcome("top_skip")}
              disabled={Boolean(pendingAction)}
            >
              {pendingAction === "skip" ? "Saving..." : "Skip"}
            </button>
          </header>

          <div className="grid flex-1 items-center gap-6 py-6 lg:grid-cols-[minmax(320px,0.68fr)_minmax(0,1.32fr)] lg:gap-10 lg:py-8 xl:gap-16">
            <section className="flex min-w-0 flex-col justify-center">
              <div
                key={`welcome-copy-${slide.id}`}
                className={`border-l border-amber-200/35 pl-5 ${
                  direction === "forward"
                    ? "arena-welcome-copy-forward"
                    : "arena-welcome-copy-backward"
                }`}
                aria-live="polite"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black tracking-[0.18em] text-amber-200/60">
                    {slide.number}
                  </span>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                    {slide.eyebrow}
                  </p>
                </div>
                <h1
                  id="dashboard-welcome-title"
                  className="mt-5 max-w-2xl text-balance font-serif text-[2.35rem] font-semibold leading-[1.02] text-white sm:text-5xl lg:text-[3.75rem]"
                >
                  {slide.title}
                </h1>
                <p
                  id="dashboard-welcome-description"
                  className="mt-5 max-w-xl text-base font-medium leading-7 text-white/62 sm:text-lg sm:leading-8"
                >
                  {slide.body}
                </p>
                <p className="mt-5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-emerald-200/72">
                  {slide.detail}
                </p>
              </div>
            </section>

            <section
              className="min-w-0"
              aria-label={`${slide.eyebrow} gameplay snapshot`}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div
                key={`welcome-visual-${slide.id}`}
                className={`arena-welcome-visual relative mx-auto aspect-[16/10] w-full max-w-[920px] overflow-hidden rounded-[1.7rem] border border-white/12 bg-[#0b0b0b] shadow-[0_36px_120px_rgba(0,0,0,0.58)] ${
                  direction === "forward"
                    ? "arena-welcome-slide-forward"
                    : "arena-welcome-slide-backward"
                }`}
              >
                <div className="flex h-10 items-center gap-2 border-b border-white/10 bg-black/72 px-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-300/55" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-200/55" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/55" />
                  <span className="ml-3 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/30">
                    {slide.visual === "intro"
                      ? "Welcome"
                      : "Gameplay"}
                  </span>
                </div>
                <div className="relative h-[calc(100%-2.5rem)] overflow-hidden bg-black">
                  <Image
                    src={slide.image}
                    alt={slide.imageAlt}
                    width={slide.imageWidth}
                    height={slide.imageHeight}
                    priority
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    draggable="false"
                    className={`h-full w-full ${
                      slide.visual === "intro"
                        ? "object-cover object-center"
                        : "object-cover object-top"
                    }`}
                  />
                  {slide.visual === "intro" ? (
                    <div className="pointer-events-none absolute inset-0 flex items-end bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.76))] p-6 sm:p-8">
                      <p className="max-w-lg font-serif text-2xl font-semibold leading-tight text-white sm:text-4xl">
                        Your case starts here.
                      </p>
                    </div>
                  ) : null}
                  {slide.visual === "intake" ? (
                    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] border-l border-white/10 bg-black/48 p-4 backdrop-blur-md sm:block">
                      <div className="h-full overflow-hidden rounded-2xl border border-amber-200/18 bg-black shadow-2xl">
                        <Image
                          src={slide.image}
                          alt=""
                          width={slide.imageWidth}
                          height={slide.imageHeight}
                          draggable="false"
                          className="h-auto w-full object-cover object-top"
                        />
                      </div>
                    </div>
                  ) : null}
                  {slide.visual === "layered" ? (
                    <div className="absolute bottom-3 right-3 w-[48%] overflow-hidden rounded-2xl border border-amber-200/30 bg-black shadow-[0_24px_70px_rgba(0,0,0,0.72)] sm:bottom-5 sm:right-5">
                      <div className="border-b border-white/10 bg-black/90 px-3 py-2 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-amber-100/72">
                        Settlement route
                      </div>
                      <Image
                        src={slide.secondaryImage}
                        alt={slide.secondaryImageAlt}
                        width={1280}
                        height={720}
                        sizes="(min-width: 640px) 28vw, 46vw"
                        draggable="false"
                        className="aspect-video w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_58%,rgba(0,0,0,0.36))]" />
                </div>
              </div>
            </section>
          </div>

          <footer className="grid items-center gap-4 border-t border-white/10 pt-4 sm:grid-cols-[1fr_auto_1fr] sm:pt-5">
            <div className="order-2 flex items-center justify-center gap-2 sm:order-1 sm:justify-start">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-white/62 transition hover:border-white/22 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                onClick={() => selectSlide(activeIndex - 1)}
                disabled={activeIndex === 0 || Boolean(pendingAction)}
                aria-label="Previous welcome slide"
              >
                <HeroIcons.ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="flex items-center gap-2 px-2" aria-label="Welcome slide selection">
                {dashboardWelcomeSlides.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`h-2 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
                      index === activeIndex
                        ? "w-8 bg-amber-200"
                        : "w-2 bg-white/20 hover:bg-white/42"
                    }`}
                    onClick={() => selectSlide(index, "dot")}
                    disabled={Boolean(pendingAction)}
                    aria-label={`Show slide ${index + 1}: ${item.eyebrow}`}
                    aria-current={index === activeIndex ? "step" : undefined}
                  />
                ))}
              </div>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-white/62 transition hover:border-white/22 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                onClick={() => {
                  if (activeIndex === dashboardWelcomeSlides.length - 1) {
                    startTour("final_next");
                    return;
                  }
                  selectSlide(activeIndex + 1);
                }}
                disabled={Boolean(pendingAction)}
                aria-label={
                  activeIndex === dashboardWelcomeSlides.length - 1
                    ? "Start the dashboard tour"
                    : "Next welcome slide"
                }
              >
                <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="ml-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/32">
                {activeIndex + 1}/{dashboardWelcomeSlides.length}
              </span>
            </div>

            <div className="order-1 flex flex-col items-center justify-center gap-2 sm:order-2 sm:flex-row">
              <button
                ref={primaryActionRef}
                type="button"
                className="arena-btn-light flex min-h-12 w-full items-center justify-center gap-3 px-6 py-3 text-sm font-black sm:min-w-[250px]"
                onClick={() => startTour("primary_cta")}
                disabled={Boolean(pendingAction)}
              >
                {pendingAction === "tour" ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <HeroIcons.SparklesIcon className="h-5 w-5" aria-hidden="true" />
                )}
                Start the quick tour
                <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="min-h-10 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold text-white/46 transition hover:bg-white/[0.05] hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                onClick={() => skipWelcome("direct_play")}
                disabled={Boolean(pendingAction)}
              >
                {pendingAction === "skip" ? "Starting..." : "Or just start playing"}
              </button>
            </div>

            <label className="order-3 flex cursor-pointer items-center justify-center gap-2.5 text-xs font-semibold text-white/52 transition hover:text-white/76 sm:justify-end">
              <input
                type="checkbox"
                className="checkbox checkbox-sm border-white/24 bg-white/[0.04] [--chkbg:#fde68a] [--chkfg:#050505]"
                checked={doNotShowAgain}
                onChange={(event) => {
                  setDoNotShowAgain(event.target.checked);
                  emit("dashboard_welcome_preference_changed", {
                    do_not_show_again: event.target.checked,
                  });
                }}
                disabled={Boolean(pendingAction)}
              />
              Don’t show again
            </label>
          </footer>

          {actionError ? (
            <p
              className="mt-3 text-center text-sm font-semibold text-rose-200"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}
        </div>
      </div>
    </dialog>,
    document.body
  );
}
