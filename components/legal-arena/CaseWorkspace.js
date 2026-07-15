"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Tooltip } from "react-tooltip";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";
import ButtonAccount from "@/components/ButtonAccount";
import { useNavigationLoading } from "@/components/NavigationLoadingProvider";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";
import { calculateSettlementXp } from "@/libs/game/settlementQuality";
import {
  hasClientSettlementAuthority,
  hasClientSettlementRejection,
} from "@/libs/game/settlementAuthority";
import {
  LAWBOOK_ALL_CATEGORIES,
  legalArenaLawbook,
} from "@/data/legalArenaLawbook";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";
import { sanitizeFactSheet } from "@/libs/game/factSheetSanitizer";
import { useCaseVoiceRecorder } from "./useCaseVoiceRecorder";
import { getCaseReportProgressLabel } from "./caseReportUi";
import { CountryBadge } from "./CountryFlagPicker";
import AwardUnlockPanel from "./AwardUnlockPanel";

import {
  normalizeCourtroomEntry,
  winnerLabel,
  winnerSignal,
  verdictTone,
  statusTone,
  helpText,
  InfoDot,
  CollapseChevron,
  getPlayerPartyName,
  getPlayerInterviewSubjectName,
  isGenericInterviewSubjectName,
  getOpponentPartyName,
  getDefendantName,
  getCaseRouteRef,
  clampPercent,
} from "./caseWorkspaceUtils";

const ensureDraftList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || ""));
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const cleanDraftList = (value) =>
  ensureDraftList(value)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeIdForCompare = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    return String(value._id || value.id || value.$oid || value);
  }

  return String(value);
};

const idsMatch = (left, right) => {
  const normalizedLeft = normalizeIdForCompare(left);
  const normalizedRight = normalizeIdForCompare(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const buildRealtimeVersionKey = (version = {}) =>
  [
    version.updatedAt || "",
    version.status || "",
    version.settlementStatus || "",
    version.settlementResolved === true ? "settlement-resolved" : "",
    version.settlementResolution || "",
    version.settlementResolvedAt || "",
    version.settlementAccepted === true ? "settlement-accepted" : "",
    version.settlementAcceptedAt || "",
    version.settlementAcceptedByUserId || "",
    version.settlementCompletedAt || "",
    version.settlementIntentPending === true ? "intent-pending" : "",
    version.settlementIntentStatus || "",
    version.settlementIntentSenderUserId || "",
    version.settlementIntentReceiverUserId || "",
    version.settlementIntentSentAt || "",
    version.settlementIntentRespondedAt || "",
    version.latestNegotiationMessageAt || "",
    version.latestNegotiationMessageUserId || "",
    version.awaitingNegotiationResponseUserId || "",
    version.negotiationTurnUserId || "",
  ].join("|");

const factSheetProgressSectionKeys = [
  "theory",
  "timeline",
  "supportingFacts",
  "risks",
  "disputedFacts",
  "corroboratedFacts",
  "missingEvidence",
  "desiredRelief",
];

const highRewardFactSheetSections = new Set(["supportingFacts", "corroboratedFacts"]);

const getFactSheetSectionCounts = (factSheet = {}) => {
  const sanitizedFactSheet = sanitizeFactSheet(factSheet || {});

  return factSheetProgressSectionKeys.reduce((counts, sectionKey) => {
    counts[sectionKey] = cleanDraftList(sanitizedFactSheet[sectionKey]).length;
    return counts;
  }, {});
};

const getFactSheetProgressDelta = (previousFactSheet = {}, nextFactSheet = {}) => {
  const previousCounts = getFactSheetSectionCounts(previousFactSheet);
  const nextCounts = getFactSheetSectionCounts(nextFactSheet);

  return factSheetProgressSectionKeys.reduce((delta, sectionKey) => {
    const gainedItems = nextCounts[sectionKey] - previousCounts[sectionKey];

    if (gainedItems > 0) {
      delta[sectionKey] = gainedItems;
    }

    return delta;
  }, {});
};

const cleanIntakePartySpeech = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^(your\s+honou?r|judge|court)\s*[:,.-]?\s*/i, "")
    .trim();

const formatSettlementCooldown = (milliseconds = 0) => {
  const totalSeconds = Math.max(0, Math.ceil(Number(milliseconds) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const triggerSettlementHaptic = () => {
  if (typeof window !== "undefined" && typeof window.navigator?.vibrate === "function") {
    window.navigator.vibrate(8);
  }
};

const CourtPortraitAvatar = ({
  src,
  alt,
  className = "",
  fallbackIcon: FallbackIcon = HeroIcons.UserIcon,
}) => {
  const cleanSrc = String(src || "").trim();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [cleanSrc]);

  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}
    >
      {cleanSrc && !imageFailed ? (
        <img
          src={cleanSrc}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <FallbackIcon className="h-6 w-6" aria-hidden="true" />
      )}
    </span>
  );
};

const intakeTourSteps = [
  {
    target: "intake-latest-exchange",
    eyebrow: "Intake",
    title: "Start the record",
    body: "Your interview appears here. At the beginning, this space is empty because you have not asked the client anything yet.",
  },
  {
    target: "intake-question-box",
    eyebrow: "Question Box",
    title: "Type your first question",
    body: "This is where you ask the client one clear question. Good intake questions usually ask about dates, records, witnesses, notice, or what happened next.",
  },
  {
    target: "intake-send-button",
    eyebrow: "Send",
    title: "Submit the question",
    body: "Once your question is ready, send it and the client will answer. Their answer can reveal facts for your case file.",
  },
  {
    target: "intake-suggestions",
    eyebrow: "Prompts",
    title: "Use a starter question",
    body: "These chips can seed the question box when you want a quick opening move.",
  },
];

const intakeTourStorageKey = "legal-arena:intake-tour-seen:v1";
const settlementTourStorageKey = "legal-arena:settlement-tour-seen:v1";

const settlementTourSteps = [
  {
    target: "settlement-offer",
    eyebrow: "Step 1",
    title: "Start in the client huddle",
    body: "This is your private side of the table. First read what your client wants before you speak for them.",
  },
  {
    target: "settlement-client-reaction",
    eyebrow: "Step 2",
    title: "Check your client's reaction",
    body: "Use the private huddle to ask what your client will accept. Respectful reassurance, clear tradeoffs, and honest risk advice can improve their mood; pressure or dismissiveness can make it worse. Repeated reassurance has diminishing returns.",
  },
  {
    target: "settlement-public-terms",
    eyebrow: "Step 3",
    title: "Check the public proposal",
    body: "This is the proposal record both sides are discussing. Compare it with what your client told you privately.",
  },
  {
    target: "settlement-message",
    eyebrow: "Step 4",
    title: "Message opposing counsel",
    body: "Write the response you want the other player to receive.",
  },
  {
    target: "settlement-next-move",
    eyebrow: "Step 5",
    title: "Choose what to do next",
    body: "Now decide: revise the offer, ask a clarifying question, accept if the terms work, or return to intake for more facts.",
  },
];

const clampOverlayValue = (value, min, max) => Math.min(Math.max(value, min), max);

const getVisibleTourTarget = (targetAttribute, target) => {
  if (typeof document === "undefined") {
    return null;
  }

  return Array.from(
    document.querySelectorAll(`[${targetAttribute}="${target}"]`)
  ).find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
};

const WorkspaceTourOverlay = ({
  isOpen,
  onComplete,
  steps,
  storageKey,
  targetAttribute,
  titleId,
  tourName,
  analyticsContext = {},
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const viewedStepsRef = useRef(new Set());
  const step = steps[stepIndex] || steps[0];

  const trackTourGoal = useCallback(
    (goal, extra = {}) => {
      trackGoal(goal, {
        tour: tourName,
        step_index: stepIndex + 1,
        step_count: steps.length,
        step_target: step?.target || "",
        step_title: step?.title || "",
        ...analyticsContext,
        ...extra,
      });
    },
    [analyticsContext, step, stepIndex, steps.length, tourName]
  );

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setTargetRect(null);
      viewedStepsRef.current = new Set();
      trackGoal("tour_started", {
        tour: tourName,
        step_count: steps.length,
        ...analyticsContext,
      });
    }
  }, [analyticsContext, isOpen, steps.length, tourName]);

  useEffect(() => {
    if (!isOpen || !step) {
      return;
    }

    const viewKey = `${stepIndex}:${step.target}`;

    if (viewedStepsRef.current.has(viewKey)) {
      return;
    }

    viewedStepsRef.current.add(viewKey);
    trackTourGoal("tour_step_viewed");
  }, [isOpen, step, stepIndex, trackTourGoal]);

  const finishTour = useCallback((reason = "completed") => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "true");
    }
    trackTourGoal(reason === "skipped" ? "tour_skipped" : "tour_completed", {
      completion_reason: reason,
    });
    onComplete();
  }, [onComplete, storageKey, trackTourGoal]);

  const findAvailableStepIndex = useCallback((startIndex, direction = 1) => {
    for (
      let index = startIndex;
      index >= 0 && index < steps.length;
      index += direction
    ) {
      if (getVisibleTourTarget(targetAttribute, steps[index].target)) {
        return index;
      }
    }

    return -1;
  }, [steps, targetAttribute]);

  const measureTarget = useCallback(() => {
    if (!isOpen || !step || typeof window === "undefined") {
      return;
    }

    const target = getVisibleTourTarget(targetAttribute, step.target);

    if (!target) {
      const nextIndex = findAvailableStepIndex(stepIndex + 1, 1);
      const previousIndex =
        nextIndex >= 0 ? -1 : findAvailableStepIndex(stepIndex - 1, -1);

      if (nextIndex >= 0 || previousIndex >= 0) {
        const fallbackIndex = nextIndex >= 0 ? nextIndex : previousIndex;
        trackTourGoal("tour_target_missing", {
          missing_target: step.target,
          fallback_step_index: fallbackIndex + 1,
          fallback_direction: nextIndex >= 0 ? "next" : "previous",
        });
        setStepIndex(fallbackIndex);
      } else {
        finishTour("no_targets_available");
      }

      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 8;

    setTargetRect({
      top: clampOverlayValue(rect.top - padding, padding, window.innerHeight - padding),
      left: clampOverlayValue(rect.left - padding, padding, window.innerWidth - padding),
      width: Math.min(rect.width + padding * 2, window.innerWidth - padding * 2),
      height: Math.min(rect.height + padding * 2, window.innerHeight - padding * 2),
      centerX: rect.left + rect.width / 2,
    });
  }, [findAvailableStepIndex, finishTour, isOpen, step, stepIndex, targetAttribute, trackTourGoal]);

  useEffect(() => {
    if (!isOpen || !step || typeof window === "undefined") {
      return;
    }

    const target = getVisibleTourTarget(targetAttribute, step.target);

    if (target) {
      target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }

    const timeoutId = window.setTimeout(measureTarget, 240);

    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [isOpen, measureTarget, step, targetAttribute]);

  if (!isOpen || !targetRect || typeof window === "undefined") {
    return null;
  }

  const calloutWidth = Math.min(360, Math.max(280, window.innerWidth - 32));
  const estimatedCalloutHeight = 230;
  const hasRoomBelow =
    targetRect.top + targetRect.height + estimatedCalloutHeight + 28 < window.innerHeight;
  const calloutTop = hasRoomBelow
    ? targetRect.top + targetRect.height + 20
    : Math.max(16, targetRect.top - estimatedCalloutHeight - 20);
  const calloutLeft = clampOverlayValue(
    targetRect.centerX - calloutWidth / 2,
    16,
    window.innerWidth - calloutWidth - 16
  );
  const arrowLeft = clampOverlayValue(targetRect.centerX - calloutLeft - 7, 24, calloutWidth - 24);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex >= steps.length - 1;

  const goToPreviousStep = () => {
    const previousIndex = findAvailableStepIndex(stepIndex - 1, -1);

    if (previousIndex >= 0) {
      trackTourGoal("tour_back_clicked", {
        destination_step_index: previousIndex + 1,
        destination_target: steps[previousIndex]?.target || "",
      });
      setStepIndex(previousIndex);
    }
  };

  const goToNextStep = () => {
    const nextIndex = findAvailableStepIndex(stepIndex + 1, 1);

    if (nextIndex >= 0) {
      trackTourGoal("tour_next_clicked", {
        destination_step_index: nextIndex + 1,
        destination_target: steps[nextIndex]?.target || "",
      });
      setStepIndex(nextIndex);
    } else {
      finishTour("no_next_step");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="fixed left-0 right-0 top-0 bg-black/72 backdrop-blur-[3px]"
        style={{ height: targetRect.top }}
      />
      <div
        className="fixed left-0 bg-black/72 backdrop-blur-[3px]"
        style={{ top: targetRect.top, width: targetRect.left, height: targetRect.height }}
      />
      <div
        className="fixed right-0 bg-black/72 backdrop-blur-[3px]"
        style={{
          top: targetRect.top,
          left: targetRect.left + targetRect.width,
          height: targetRect.height,
        }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 bg-black/72 backdrop-blur-[3px]"
        style={{ top: targetRect.top + targetRect.height }}
      />
      <div
        className="pointer-events-none fixed rounded-2xl border border-amber-100/90 bg-transparent shadow-[0_0_0_6px_rgba(251,191,36,0.12),0_20px_80px_rgba(0,0,0,0.55)] transition-all duration-200"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />
      <div
        className="fixed rounded-2xl border border-white/12 bg-[#111] p-4 text-white shadow-2xl transition-all duration-200 sm:p-5"
        style={{ top: calloutTop, left: calloutLeft, width: calloutWidth }}
      >
        <span
          className={`absolute h-3.5 w-3.5 rotate-45 border-white/12 bg-[#111] ${
            hasRoomBelow ? "-top-2 border-l border-t" : "-bottom-2 border-b border-r"
          }`}
          style={{ left: arrowLeft }}
          aria-hidden="true"
        />
        <p className="arena-kicker text-amber-200">{step.eyebrow}</p>
        <h2 id={titleId} className="mt-2 text-lg font-semibold">
          {step.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/68">{step.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-white/42">
            {stepIndex + 1} / {steps.length}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
              onClick={() => finishTour("skipped")}
            >
              Skip
            </button>
            <button
              type="button"
              className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
              onClick={goToPreviousStep}
              disabled={isFirstStep}
            >
              Back
            </button>
            <button
              type="button"
              className="arena-btn-light min-h-0 px-4 py-2 text-sm"
              onClick={isLastStep ? () => finishTour("completed") : goToNextStep}
            >
              {isLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const IntakeTourOverlay = ({ isOpen, onComplete, analyticsContext }) => (
  <WorkspaceTourOverlay
    isOpen={isOpen}
    onComplete={onComplete}
    steps={intakeTourSteps}
    storageKey={intakeTourStorageKey}
    targetAttribute="data-intake-tour-target"
    titleId="intake-tour-title"
    tourName="intake"
    analyticsContext={analyticsContext}
  />
);

const SettlementTourOverlay = ({ isOpen, onComplete, analyticsContext }) => (
  <WorkspaceTourOverlay
    isOpen={isOpen}
    onComplete={onComplete}
    steps={settlementTourSteps}
    storageKey={settlementTourStorageKey}
    targetAttribute="data-settlement-tour-target"
    titleId="settlement-tour-title"
    tourName="settlement"
    analyticsContext={analyticsContext}
  />
);

const missingEvidenceUnavailablePattern =
  /\b(no|none|never|does not exist|doesn't exist|did not exist|didn't exist|not available|unavailable|cannot get|can't get|unobtainable|destroyed|lost|client never|never took|never received|other side has|opposing side has|landlord has|tenant has|third party has|only the other side|not provided to me)\b/i;

const missingEvidenceUncertainPattern =
  /\b(any|if one exists|if it exists|may have|might have|should have|could have|likely has|prepared but did not provide|do not know|don't know|not sure|need to ask|need to confirm)\b/i;

const evidenceRecordPattern =
  /\b(portal|message|messages|text|texts|email|emails|lease|agreement|receipt|receipts|photo|photos|screenshot|screenshots|statement|checklist|inspection|invoice|invoices|record|records|document|documents|work order|work orders)\b/i;

const evidenceAvailabilityPattern =
  /\b(i have|i may have|may have|might have|should have|i believe i have|believe i have|i'm pretty sure|i am pretty sure|yes|available|likely available|can get|could get)\b/i;

const getMissingEvidenceTone = (item = "") => {
  if (missingEvidenceUnavailablePattern.test(item)) {
    return "unavailable";
  }

  if (missingEvidenceUncertainPattern.test(item)) {
    return "actionable";
  }

  return "actionable";
};

const formatMissingEvidenceLabel = (item = "") =>
  String(item || "").replace(/^unavailable:\s*/i, "");

const shouldPromptForEvidenceProduction = (text = "") => {
  const normalizedText = String(text || "");
  return evidenceRecordPattern.test(normalizedText) && evidenceAvailabilityPattern.test(normalizedText);
};

const getEvidenceFollowUpQuestions = (item = "") => {
  const text = String(item || "").toLowerCase();

  if (/\bportal|maintenance request|repair request/.test(text)) {
    return [
      "Read me the portal message, including the date and exact wording.",
      "What did the portal request say about the repair issue?",
    ];
  }

  if (/\btext|message/.test(text)) {
    return [
      "Read me the text message, including who sent it and when.",
      "What exactly did the manager text say?",
    ];
  }

  if (/\blease|agreement/.test(text)) {
    return [
      "Read me the lease clause that supports this point.",
      "What exact lease language applies here?",
    ];
  }

  if (/\breceipt|payment|deposit/.test(text)) {
    return [
      "What does the receipt or payment record show?",
      "Read me the date and amount on the deposit proof.",
    ];
  }

  if (/\bphoto|screenshot/.test(text)) {
    return [
      "Describe what the photo or screenshot shows.",
      "When was the photo or screenshot taken?",
    ];
  }

  if (/\bstatement|checklist|inspection|invoice|work order|record|document/.test(text)) {
    return [
      "Read me the record's date and exact wording.",
      "What specific amounts or details does that record show?",
    ];
  }

  return [
    "Read me the record's date and exact wording.",
    "What specific detail does that evidence prove?",
  ];
};

const strongProofPattern =
  /\b(photo|photos|message|messages|text|texts|receipt|receipts|invoice|invoices|letter|email|emails|witness|witnesses|record|records|checklist|inspection|lease|statement|bank|deposit|paid|returned the keys|notice)\b/i;

const coreHelpfulFactPattern =
  /\b(security deposit|deposit|paid rent|paid on time|cleaned|ordinary wear|ordinary wear and tear|returned the keys|gave notice|not justified|unsupported|not provided|withheld|deduction|deductions|repair charges|text messages|move-out instructions)\b/i;

const seriousWeaknessPattern =
  /\b(no|not|none|lack|missing|cannot|can't|unavailable|unsupported|vague|credibility|depends|may say|might say|inspection|photos|proof|receipts|invoice|letter|not confirmed|harder to prove)\b/i;

const centralDisputePattern =
  /\b(dispute|disputed|fight|argue|condition|clean|ordinary wear|damage|deduction|deductions|withheld|deposit|repair|repairs|charges|notice|timeline|amount|owed)\b/i;

const getFactSheetItemTone = (sectionKey, item = "") => {
  const text = String(item || "");

  if (sectionKey === "missingEvidence") {
    return getMissingEvidenceTone(text) === "unavailable" ? "danger" : "secondary";
  }

  if (sectionKey === "supportingFacts") {
    return coreHelpfulFactPattern.test(text) ? "strong" : "secondary";
  }

  if (sectionKey === "corroboratedFacts") {
    return strongProofPattern.test(text) ? "strong" : "secondary";
  }

  if (sectionKey === "risks") {
    return seriousWeaknessPattern.test(text) ? "danger" : "secondary";
  }

  if (sectionKey === "disputedFacts") {
    return centralDisputePattern.test(text) ? "danger" : "secondary";
  }

  return "secondary";
};

const factSheetBulletToneClass = {
  danger: "bg-red-400/85",
  strong: "bg-emerald-300/85",
  secondary: "bg-amber-300/80",
};

const LoadingBar = ({ label = "Loading" }) => (
  <div className="space-y-2" role="status" aria-label={label}>
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className="arena-loading-bar h-full w-1/3 rounded-full bg-amber-300/85" />
    </div>
    <span className="sr-only">{label}</span>
  </div>
);

const TypingIndicator = ({ speaker }) => (
  <div
    className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200/12 bg-black/20 px-3 py-2"
    role="status"
    aria-label={`${speaker} is typing`}
  >
    <span className="sr-only">{speaker} is typing</span>
    <span className="h-2 w-2 rounded-full bg-amber-200/80 arena-typing-dot" />
    <span className="h-2 w-2 rounded-full bg-amber-200/80 arena-typing-dot [animation-delay:140ms]" />
    <span className="h-2 w-2 rounded-full bg-amber-200/80 arena-typing-dot [animation-delay:280ms]" />
  </div>
);

const VoiceWaveform = ({ level = 0 }) => {
  const normalizedLevel = Math.min(1, Math.max(0, Number(level) || 0));
  const bars = [0.35, 0.65, 1, 0.8, 0.45];

  return (
    <span
      className="arena-voice-waveform"
      aria-hidden="true"
      style={{ "--voice-level": normalizedLevel }}
    >
      {bars.map((weight, index) => (
        <span
          key={`${weight}-${index}`}
          className="arena-voice-waveform-bar"
          style={{ "--bar-level": normalizedLevel * weight }}
        />
      ))}
    </span>
  );
};

const PresentingArgumentIndicator = ({ captionClassName = "text-black/62" }) => (
  <span className="flex flex-col items-center justify-center gap-1.5">
    <span className="inline-flex items-center justify-center gap-2">
      <HeroIcons.ScaleIcon className="h-5 w-5 animate-pulse" aria-hidden="true" />
      <span>Presenting</span>
      <span className="loading loading-dots loading-xs" aria-hidden="true" />
    </span>
    <span className={`block text-xs font-medium ${captionClassName}`}>
      Submitting your argument to the judge
    </span>
  </span>
);

const categoryTitleBySlug = new Map(
  LEGAL_CASE_CATEGORIES.map((category) => [category.slug, category.title])
);

const lawbookFilterOptions = [
  { slug: LAWBOOK_ALL_CATEGORIES, title: "All" },
  ...LEGAL_CASE_CATEGORIES,
];

const LawbookRuleIcon = ({ icon, className = "h-5 w-5" }) => {
  const Icon = HeroIcons[icon] || HeroIcons.ScaleIcon;

  return <Icon className={className} aria-hidden="true" />;
};

const factSheetSectionIconMap = {
  theory: HeroIcons.LightBulbIcon,
  timeline: HeroIcons.ClockIcon,
  supportingFacts: HeroIcons.FolderIcon,
  risks: HeroIcons.ExclamationTriangleIcon,
  disputedFacts: HeroIcons.QuestionMarkCircleIcon,
  corroboratedFacts: HeroIcons.ShieldCheckIcon,
  missingEvidence: HeroIcons.MagnifyingGlassIcon,
  desiredRelief: HeroIcons.ScaleIcon,
};

const factSheetSectionCompactLabel = {
  theory: "Theory",
  timeline: "Timeline",
  supportingFacts: "Proof",
  risks: "Risks",
  disputedFacts: "Disputed",
  corroboratedFacts: "Records",
  missingEvidence: "Gaps",
  desiredRelief: "Relief",
};

const filterLawbookRulesByCategory = (rules, categorySlug) => {
  if (!categorySlug || categorySlug === LAWBOOK_ALL_CATEGORIES) {
    return rules;
  }

  return rules.filter(
    (rule) => rule.universal || rule.categorySlugs?.includes(categorySlug)
  );
};

const SuccessChanceTooltip = ({ reasons, isInterview }) => (
  <div className="w-72 text-left text-sm leading-5">
    <p className="font-semibold text-white">Success chance factors</p>
    {reasons.length > 0 ? (
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-white/82">
        {reasons.map((reason, index) => (
          <li key={`${reason}-${index}`}>{reason}</li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-white/72">
        {isInterview
          ? "Updates after client answers."
          : "Locked when the case entered court."}
      </p>
    )}
  </div>
);

const IntakeProgressRing = ({ value }) => {
  const progress = clampPercent(Number(value) || 0);
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="relative grid h-16 w-16 shrink-0 place-items-center"
      role="img"
      aria-label={`${Math.round(progress)}% fact sheet complete`}
    >
      <svg
        className="h-16 w-16 -rotate-90"
        viewBox="0 0 64 64"
        aria-hidden="true"
      >
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="8"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.95)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums text-white">
        {Math.round(progress)}%
      </span>
    </div>
  );
};

const INTERVIEW_HISTORY_DEFAULT_HEIGHT = 240;
const INTERVIEW_HISTORY_MIN_HEIGHT = 140;
const INTERVIEW_HISTORY_MAX_HEIGHT = 520;

const clampInterviewHistoryHeight = (value) =>
  Math.min(
    INTERVIEW_HISTORY_MAX_HEIGHT,
    Math.max(INTERVIEW_HISTORY_MIN_HEIGHT, Math.round(Number(value) || 0))
  );

const formatSettlementMoodScore = (value) => {
  const score = Math.round(Number(value) || 0);
  return `${score > 0 ? "+" : ""}${score}`;
};

const getSettlementMoodEmoji = (value) => {
  const score = Number(value) || 0;
  if (score >= 45) return "😊";
  if (score >= 10) return "🙂";
  if (score > -20) return "😐";
  if (score > -55) return "😟";
  return "😡";
};

const getSettlementMoodMeterState = (value) => {
  const score = Math.max(-100, Math.min(100, Math.round(Number(value) || 0)));
  const positivePercent = Math.max(0, score);
  const negativePercent = Math.max(0, -score);
  const positiveTone =
    score >= 60
      ? "bg-emerald-300"
      : score >= 25
        ? "bg-lime-300"
        : "bg-amber-300";
  const negativeTone = score <= -25 ? "bg-red-300" : "bg-orange-300";
  const scoreTone =
    score < -25
      ? "text-red-100"
      : score < 0
        ? "text-orange-100"
        : score >= 60
          ? "text-emerald-100"
          : "text-amber-100";

  return { negativePercent, negativeTone, positivePercent, positiveTone, score, scoreTone };
};

const SettlementMoodMeter = ({ value, label, moodLabel, reason = "", compact = false }) => {
  const { negativePercent, negativeTone, positivePercent, positiveTone, score, scoreTone } =
    getSettlementMoodMeterState(value);

  return (
    <div className={compact ? "rounded-lg bg-black/18 px-3 py-2" : "rounded-xl bg-black/18 p-4"}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-lg leading-none" aria-hidden="true">
          {getSettlementMoodEmoji(score)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 text-xs font-black">
            <span className="min-w-0 text-white/62">{label}</span>
            <span className={`shrink-0 text-right ${scoreTone}`}>
              {moodLabel} {formatSettlementMoodScore(score)}
            </span>
          </div>
          {reason ? (
            <p className="mt-1 text-xs font-semibold leading-4 text-white/46">{reason}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5" aria-hidden="true">
        <div className="h-2 overflow-hidden rounded-l-full bg-white/[0.07]">
          <div
            className={`ml-auto h-full rounded-l-full ${negativeTone}`}
            style={{ width: `${negativePercent}%` }}
          />
        </div>
        <div className="h-2 overflow-hidden rounded-r-full bg-white/[0.07]">
          <div
            className={`h-full rounded-r-full ${positiveTone}`}
            style={{ width: `${positivePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const SettlementPartyPortrait = ({ image, name, tone = "emerald", fallbackIcon: FallbackIcon }) => {
  const toneClass =
    tone === "red"
      ? "bg-red-300/10 text-red-200"
      : "bg-emerald-300/10 text-emerald-200";

  return (
    <span
      className={`relative grid h-16 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl ${toneClass} shadow-[0_16px_34px_rgba(0,0,0,0.26)] sm:h-[4.5rem] sm:w-16`}
    >
      {image ? (
        <img
          src={image}
          alt={`${name} portrait`}
          width={320}
          height={360}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <FallbackIcon className="h-8 w-8" aria-hidden="true" />
      )}
    </span>
  );
};

export default function CaseWorkspace({
  initialCase,
  apiConfig = {},
  workspaceNotice = null,
}) {
  const router = useRouter();
  const { startNavigationLoading } = useNavigationLoading();
  const initialFactSheet = sanitizeFactSheet(initialCase.factSheet || {});
  const [caseSession, setCaseSession] = useState(() => ({
    ...initialCase,
    factSheet: initialFactSheet,
  }));
  const [awardChanges, setAwardChanges] = useState([]);
  const [awardEvaluationStatus, setAwardEvaluationStatus] = useState("not_started");
  const [question, setQuestion] = useState("");
  const [argument, setArgument] = useState("");
  const [settlementMessage, setSettlementMessage] = useState("");
  const [settlementClientInstruction, setSettlementClientInstruction] = useState("");
  const [settlementClientInstructionWorking, setSettlementClientInstructionWorking] = useState(false);
  const [settlementDraftState, setSettlementDraftState] = useState({
    sourceSignature: "",
    values: {},
    dirty: false,
  });
  const [settlementClientPreview, setSettlementClientPreview] = useState(
    () => initialCase.settlement?.clientPreview || null
  );
  const [settlementClientPreviewError, setSettlementClientPreviewError] = useState("");
  const [settlementAcceptAuthority, setSettlementAcceptAuthority] = useState({
    offerSignature: "",
    authority: "unclear",
    reason: "",
  });
  const [settlementClientCounselNote, setSettlementClientCounselNote] = useState("");
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);
  const [showSettlementComposeModal, setShowSettlementComposeModal] = useState(false);
  const [settlementRejected, setSettlementRejected] = useState(false);
  const [settlementCooldownNow, setSettlementCooldownNow] = useState(() => Date.now());
  const [courtroomTimerNow, setCourtroomTimerNow] = useState(() => Date.now());
  const [showSettlementMatterSummary, setShowSettlementMatterSummary] = useState(false);
  const [showClientWalkoutModal, setShowClientWalkoutModal] = useState(false);
  const [clientWalkoutCountdown, setClientWalkoutCountdown] = useState(5);
  const [activeSettlementInfo, setActiveSettlementInfo] = useState(null);
  const [isSettlementInfoModalOpen, setIsSettlementInfoModalOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [pendingSpeaker, setPendingSpeaker] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const [finalizeFeedback, setFinalizeFeedback] = useState(null);
  const [optimisticTranscriptEntry, setOptimisticTranscriptEntry] = useState(null);
  const [selectedLawbookCategory, setSelectedLawbookCategory] = useState(
    initialCase.primaryCategory || LAWBOOK_ALL_CATEGORIES
  );
  const [lawbookSearch, setLawbookSearch] = useState("");
  const [showFullMobileBrief, setShowFullMobileBrief] = useState(false);
  const [showMobileExchangeHistory, setShowMobileExchangeHistory] = useState(false);
  const [interviewHistoryHeight, setInterviewHistoryHeight] = useState(
    INTERVIEW_HISTORY_DEFAULT_HEIGHT
  );
  const [showFullMobileOpponentArgument, setShowFullMobileOpponentArgument] = useState(false);
  const [activeMobileFactSheetKey, setActiveMobileFactSheetKey] = useState("theory");
  const [showMobileFactSheetDialog, setShowMobileFactSheetDialog] = useState(false);
  const [showMobileBriefDialog, setShowMobileBriefDialog] = useState(false);
  const [showMobileLawbookDialog, setShowMobileLawbookDialog] = useState(false);
  const [showIntakeTour, setShowIntakeTour] = useState(false);
  const [showSettlementTour, setShowSettlementTour] = useState(false);
  const [recentFactSheetProgress, setRecentFactSheetProgress] = useState({});
  const [caseReport, setCaseReport] = useState({ status: "loading" });
  const [caseReportPreferences, setCaseReportPreferences] = useState({
    autoPublishCaseReports: false,
    allowPortraitInCaseReports: false,
  });
  const [caseReportWorking, setCaseReportWorking] = useState(false);
  const interviewTranscriptRef = useRef(null);
  const courtroomTranscriptRef = useRef(null);
  const settlementTopRef = useRef(null);
  const settlementMessageComposerRef = useRef(null);
  const settlementMessageTextareaRef = useRef(null);
  const settlementResolvedRef = useRef(
    initialCase.status === "settled" ||
      initialCase.settlement?.status === "settled" ||
      initialCase.settlement?.accepted === true ||
      initialCase.settlement?.resolution === "settled"
  );
  const requestedOpponentPortraitRef = useRef(new Set());
  const workingRef = useRef(false);
  const updateCaseFromResponseRef = useRef(null);
  const realtimeVersionKeyRef = useRef(
    buildRealtimeVersionKey({
      updatedAt: initialCase.updatedAt,
      status: initialCase.status,
      settlementStatus: initialCase.settlement?.status,
      settlementResolved: initialCase.settlement?.resolved,
      settlementResolution: initialCase.settlement?.resolution,
      settlementResolvedAt: initialCase.settlement?.resolvedAt,
      settlementAccepted: initialCase.settlement?.accepted,
      settlementAcceptedAt: initialCase.settlement?.acceptedAt,
      settlementAcceptedByUserId: initialCase.settlement?.acceptedByUserId,
      settlementCompletedAt: initialCase.settlement?.completedAt,
      settlementIntentPending: initialCase.settlement?.intentPending,
      settlementIntentStatus: initialCase.settlement?.intentStatus,
      settlementIntentSenderUserId: initialCase.settlement?.intentSenderUserId,
      settlementIntentReceiverUserId: initialCase.settlement?.intentReceiverUserId,
      settlementIntentSentAt: initialCase.settlement?.intentSentAt,
      settlementIntentRespondedAt: initialCase.settlement?.intentRespondedAt,
      latestNegotiationMessageAt: initialCase.settlement?.latestNegotiationMessageAt,
      latestNegotiationMessageUserId: initialCase.settlement?.latestNegotiationMessageUserId,
      awaitingNegotiationResponseUserId:
        initialCase.settlement?.awaitingNegotiationResponseUserId,
      negotiationTurnUserId: initialCase.settlement?.negotiationTurnUserId,
    })
  );
  const workspaceViewedRef = useRef(false);
  const intakeTourPromptedRef = useRef(false);
  const settlementTourPromptedRef = useRef(false);
  const autoPublishAttemptedRef = useRef(false);
  const {
    recordingQuestion,
    transcribingQuestion,
    recordingArgument,
    transcribingArgument,
    argumentAudioLevel,
    recordingSettlementClientInstruction,
    transcribingSettlementClientInstruction,
    settlementClientInstructionAudioLevel,
    recordingSettlementMessage,
    transcribingSettlementMessage,
    settlementMessageAudioLevel,
    handleQuestionVoiceInput,
    handleArgumentVoiceInput,
    handleSettlementClientInstructionVoiceInput,
    handleSettlementMessageVoiceInput,
  } = useCaseVoiceRecorder({
    setQuestion,
    setArgument,
    setSettlementClientInstruction,
    setSettlementMessage,
  });
  const focusSettlementMessageComposer = useCallback(() => {
    setShowSettlementComposeModal(true);
    window.requestAnimationFrame(() => {
      settlementMessageTextareaRef.current?.focus({ preventScroll: true });
    });
  }, []);
  const setSettlementMessageAndFocus = useCallback(
    (messageOrUpdater) => {
      setSettlementMessage(messageOrUpdater);
      focusSettlementMessageComposer();
    },
    [focusSettlementMessageComposer]
  );
  const resizeInterviewHistoryBy = (delta) => {
    setInterviewHistoryHeight((current) => clampInterviewHistoryHeight(current + delta));
  };
  const handleInterviewHistoryResizeStart = (event) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = interviewHistoryHeight;
    const maxHeight = Math.min(
      INTERVIEW_HISTORY_MAX_HEIGHT,
      Math.max(
        INTERVIEW_HISTORY_MIN_HEIGHT,
        Math.round((window.innerHeight || INTERVIEW_HISTORY_MAX_HEIGHT) * 0.58)
      )
    );

    const handlePointerMove = (moveEvent) => {
      const nextHeight = startHeight + moveEvent.clientY - startY;
      setInterviewHistoryHeight(
        Math.min(maxHeight, Math.max(INTERVIEW_HISTORY_MIN_HEIGHT, Math.round(nextHeight)))
      );
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };
  const [factSheetDraft, setFactSheetDraft] = useState({
    summary: ensureDraftList(initialFactSheet.summary),
    theory: ensureDraftList(initialFactSheet.theory),
    desiredRelief: ensureDraftList(initialFactSheet.desiredRelief),
    timeline: ensureDraftList(initialFactSheet.timeline),
    supportingFacts: ensureDraftList(initialFactSheet.supportingFacts),
    risks: ensureDraftList(initialFactSheet.risks),
    disputedFacts: ensureDraftList(initialFactSheet.disputedFacts),
    corroboratedFacts: ensureDraftList(initialFactSheet.corroboratedFacts),
    missingEvidence: ensureDraftList(initialFactSheet.missingEvidence),
  });
  const getApiBasePath = (session = caseSession) =>
    apiConfig.basePath || `/cases/${getCaseRouteRef(session)}`;
  const getWorkspaceHref = (session = caseSession) =>
    apiConfig.workspaceHref || `/dashboard/cases/${getCaseRouteRef(session)}`;
  const getSettlementHref = (session = caseSession) =>
    apiConfig.settlementHref || `${getWorkspaceHref(session)}/settlement`;
  const realtimeRefreshPath = apiConfig.realtimeRefreshPath || getApiBasePath(caseSession);
  const realtimeVersionPath = apiConfig.realtimeVersionPath || "";
  const realtimeVersionIntervalMs = apiConfig.realtimeVersionIntervalMs || 1500;
  const realtimeRefreshIntervalMs = apiConfig.realtimeRefreshIntervalMs || 4000;
  const analyticsMode = apiConfig.analyticsMode || (apiConfig.basePath ? "pvp" : "solo");
  const caseReportSourceType = analyticsMode === "pvp" ? "challenge" : "caseSession";
  const caseReportSourceId = normalizeIdForCompare(caseSession.id || caseSession._id);
  const caseReportPath = `/case-reports/${caseReportSourceType}/${caseReportSourceId}`;
  const caseReportIsVerdict = caseSession.status === "verdict";

  const publishCaseReport = useCallback(async ({ automatic = false } = {}) => {
    if (!caseReportSourceId || caseReportWorking) return;
    setCaseReportWorking(true);
    setCaseReport((current) => ({ ...current, status: "generating" }));
    try {
      const response = await apiClient.post(caseReportPath);
      setCaseReport(response.report || { status: "not_started" });
      if (!automatic) {
        toast.success(response.report?.status === "awaiting_consent" ? "Publication consent saved. Waiting for the other lawyer." : "Case report published.");
      }
    } catch (error) {
      setCaseReport((current) => ({ ...current, status: "failed", canRetry: true }));
    } finally {
      setCaseReportWorking(false);
    }
  }, [caseReportPath, caseReportSourceId, caseReportWorking]);

  const updateCaseReportPreference = async (key, value) => {
    const previous = caseReportPreferences;
    const next = { ...previous, [key]: value };
    setCaseReportPreferences(next);
    try {
      const response = await apiClient.patch("/players/case-report-preferences", { [key]: value });
      setCaseReportPreferences(response.preferences || next);
    } catch (error) {
      setCaseReportPreferences(previous);
    }
  };

  const handleUnpublishCaseReport = async () => {
    if (!window.confirm("Unpublish this report? It cannot be generated again from this case.")) return;
    setCaseReportWorking(true);
    try {
      const response = await apiClient.delete(caseReportPath);
      setCaseReport(response.report);
      toast.success("Case report unpublished.");
    } finally {
      setCaseReportWorking(false);
    }
  };

  useEffect(() => {
    if (!caseReportIsVerdict || !caseReportSourceId) return;
    let active = true;
    Promise.all([
      apiClient.get(caseReportPath),
      apiClient.get("/players/case-report-preferences"),
    ]).then(([reportResponse, preferencesResponse]) => {
      if (!active) return;
      const report = reportResponse.report || { status: "not_started" };
      const preferences = preferencesResponse.preferences || {};
      setCaseReport(report);
      setCaseReportPreferences(preferences);
      if (preferences.autoPublishCaseReports && report.status === "not_started" && !autoPublishAttemptedRef.current) {
        autoPublishAttemptedRef.current = true;
        publishCaseReport({ automatic: true });
      }
    }).catch(() => { if (active) setCaseReport({ status: "not_started" }); });
    return () => { active = false; };
  }, [caseReportIsVerdict, caseReportPath, caseReportSourceId, publishCaseReport]);

  useEffect(() => {
    if (!caseReportWorking && caseReport.status !== "generating") return;
    const interval = window.setInterval(async () => {
      try {
        const response = await apiClient.get(caseReportPath);
        if (response.report) setCaseReport(response.report);
      } catch (error) {
        // The publishing request remains authoritative; polling can safely retry.
      }
    }, 1200);
    return () => window.clearInterval(interval);
  }, [caseReport.status, caseReportPath, caseReportWorking]);
  const caseAnalyticsParams = (extra = {}) => ({
    mode: analyticsMode,
    status: caseSession.status,
    category: caseSession.primaryCategory,
    complexity: caseSession.complexity,
    side: caseSession.playerSide,
    ...extra,
  });
  const tourAnalyticsContext = useMemo(
    () => ({
      mode: analyticsMode,
      status: caseSession.status,
      category: caseSession.primaryCategory,
      complexity: caseSession.complexity,
      side: caseSession.playerSide,
      case_id: caseSession.id || caseSession._id || "",
      case_ref: getCaseRouteRef(caseSession),
    }),
    [
      analyticsMode,
      caseSession,
    ]
  );
  const getResponseCase = (response) =>
    apiConfig.responseToCase ? apiConfig.responseToCase(response) : response?.caseSession;
  const updateCaseFromResponse = (response) => {
    const changes = response?.awardEvaluation?.changes || [];
    if (response?.awardEvaluation?.status) {
      setAwardEvaluationStatus(response.awardEvaluation.status);
    }
    if (changes.length) {
      setAwardChanges((current) => {
        const seen = new Set(current.map((item) => `${item.code}:${item.type}:${item.tier || ""}`));
        return [...current, ...changes.filter((item) => !seen.has(`${item.code}:${item.type}:${item.tier || ""}`))];
      });
    }
    const nextCase = getResponseCase(response);

    if (!nextCase) {
      return null;
    }

    setCaseSession({
      ...nextCase,
      factSheet: sanitizeFactSheet(nextCase.factSheet || {}),
    });
    realtimeVersionKeyRef.current = buildRealtimeVersionKey({
      updatedAt: nextCase.updatedAt,
      status: nextCase.status,
      settlementStatus: nextCase.settlement?.status,
      settlementResolved: nextCase.settlement?.resolved,
      settlementResolution: nextCase.settlement?.resolution,
      settlementResolvedAt: nextCase.settlement?.resolvedAt,
      settlementAccepted: nextCase.settlement?.accepted,
      settlementAcceptedAt: nextCase.settlement?.acceptedAt,
      settlementAcceptedByUserId: nextCase.settlement?.acceptedByUserId,
      settlementCompletedAt: nextCase.settlement?.completedAt,
      settlementIntentPending: nextCase.settlement?.intentPending,
      settlementIntentStatus: nextCase.settlement?.intentStatus,
      settlementIntentSenderUserId: nextCase.settlement?.intentSenderUserId,
      settlementIntentReceiverUserId: nextCase.settlement?.intentReceiverUserId,
      settlementIntentSentAt: nextCase.settlement?.intentSentAt,
      settlementIntentRespondedAt: nextCase.settlement?.intentRespondedAt,
      latestNegotiationMessageAt: nextCase.settlement?.latestNegotiationMessageAt,
      latestNegotiationMessageUserId: nextCase.settlement?.latestNegotiationMessageUserId,
      awaitingNegotiationResponseUserId:
        nextCase.settlement?.awaitingNegotiationResponseUserId,
      negotiationTurnUserId: nextCase.settlement?.negotiationTurnUserId,
    });

    return nextCase;
  };

  const triggerFactSheetProgress = (progressDelta = {}) => {
    setRecentFactSheetProgress(
      Object.keys(progressDelta).reduce((latestProgress, sectionKey) => {
        if (progressDelta[sectionKey] > 0) {
          latestProgress[sectionKey] = progressDelta[sectionKey];
        }

        return latestProgress;
      }, {})
    );
  };

  useEffect(() => {
    workingRef.current = working;
  }, [working]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    updateCaseFromResponseRef.current = updateCaseFromResponse;
  });

  useEffect(() => {
    const sanitizedFactSheet = sanitizeFactSheet(caseSession.factSheet || {});
    setFactSheetDraft({
      summary: ensureDraftList(sanitizedFactSheet.summary),
      theory: ensureDraftList(sanitizedFactSheet.theory),
      desiredRelief: ensureDraftList(sanitizedFactSheet.desiredRelief),
      timeline: ensureDraftList(sanitizedFactSheet.timeline),
      supportingFacts: ensureDraftList(sanitizedFactSheet.supportingFacts),
      risks: ensureDraftList(sanitizedFactSheet.risks),
      disputedFacts: ensureDraftList(sanitizedFactSheet.disputedFacts),
      corroboratedFacts: ensureDraftList(sanitizedFactSheet.corroboratedFacts),
      missingEvidence: ensureDraftList(sanitizedFactSheet.missingEvidence),
    });
  }, [caseSession]);

  const buildFactSheetPayload = () =>
    sanitizeFactSheet({
      ...caseSession.factSheet,
      summary: cleanDraftList(factSheetDraft.summary),
      theory: cleanDraftList(factSheetDraft.theory),
      desiredRelief: cleanDraftList(factSheetDraft.desiredRelief),
      timeline: cleanDraftList(factSheetDraft.timeline),
      supportingFacts: cleanDraftList(factSheetDraft.supportingFacts),
      risks: cleanDraftList(factSheetDraft.risks),
      disputedFacts: cleanDraftList(factSheetDraft.disputedFacts),
      corroboratedFacts: cleanDraftList(factSheetDraft.corroboratedFacts),
      missingEvidence: cleanDraftList(factSheetDraft.missingEvidence),
    });

  const visibleInterviewTranscript = useMemo(
    () =>
      optimisticTranscriptEntry
        ? [...caseSession.interviewTranscript, optimisticTranscriptEntry]
        : caseSession.interviewTranscript,
    [caseSession.interviewTranscript, optimisticTranscriptEntry]
  );

  const visibleCourtroomTranscript = useMemo(
    () =>
      optimisticTranscriptEntry
        ? [...caseSession.courtroomTranscript, optimisticTranscriptEntry]
        : caseSession.courtroomTranscript,
    [caseSession.courtroomTranscript, optimisticTranscriptEntry]
  );
  const normalizedCourtroomTranscript =
    visibleCourtroomTranscript.map(normalizeCourtroomEntry);
  const isSettlementAccepted = Boolean(
    caseSession.status === "settled" ||
      caseSession.settlement?.accepted === true ||
      caseSession.settlement?.resolution === "settled" ||
      caseSession.settlement?.status === "settled"
  );
  const hasActiveSettlement = Boolean(
    !isSettlementAccepted &&
      caseSession.settlement?.resolution !== "failed" &&
      caseSession.settlement?.resolution !== "rejected" &&
      !["failed", "rejected"].includes(caseSession.settlement?.status) &&
      (caseSession.settlement?.status === "active" ||
        caseSession.settlement?.status === "proposed" ||
        caseSession.settlement?.intentPending === true ||
        ["pending", "accepted"].includes(caseSession.settlement?.intentStatus) ||
        (Array.isArray(caseSession.settlement?.transcript) &&
          caseSession.settlement.transcript.length > 0))
  );
  const isInterview = caseSession.status === "interview";
  const isSettlement = Boolean(
    (caseSession.status === "settlement" || hasActiveSettlement) &&
      !isSettlementAccepted
  );
  const isSettled = isSettlementAccepted;
  const isVerdict = caseSession.status === "verdict";
  const isExited = caseSession.status === "exited";
  useEffect(() => {
    if ((!isVerdict && !isSettled) || ["completed", "partially_completed"].includes(awardEvaluationStatus)) return;
    const sourceType = analyticsMode === "pvp" ? "challenge" : "case";
    const sourceId = caseSession.id || caseSession._id;
    if (!sourceId) return;
    let active = true;
    const poll = async () => {
      try {
        const result = await apiClient.get(`/award-evaluations/${sourceType}/${sourceId}`);
        if (!active) return;
        setAwardEvaluationStatus(result.status || "not_started");
        if (result.changes?.length) {
          setAwardChanges((current) => {
            const seen = new Set(current.map((item) => `${item.code}:${item.type}:${item.tier || ""}`));
            return [...current, ...result.changes.filter((item) => !seen.has(`${item.code}:${item.type}:${item.tier || ""}`))];
          });
        }
      } catch (error) {
        // Award processing is intentionally non-blocking and the next poll may recover.
      }
    };
    poll();
    const interval = window.setInterval(poll, 2500);
    return () => { active = false; window.clearInterval(interval); };
  }, [analyticsMode, awardEvaluationStatus, caseSession.id, caseSession._id, isSettled, isVerdict]);
  const isIntakeLocked = Boolean(apiConfig.intakeLocked);
  const canSettleCase = caseSession.primaryCategory !== "criminal";
  const hasSettlementAuthority = hasClientSettlementAuthority(
    visibleInterviewTranscript
  );
  const hasSettlementRejection = hasClientSettlementRejection(
    visibleInterviewTranscript
  );
  const settlementCaseContextLine = `${getPlayerPartyName(caseSession)} vs ${getOpponentPartyName(caseSession)} · You represent ${caseSession.playerSide === "opponent" ? "Defendant" : "Plaintiff"}`;
  const viewerSubmittedCurrentRound = Boolean(caseSession.score.viewerSubmittedCurrentRound);
  const opponentSubmittedCurrentRound = Boolean(
    caseSession.score.opponentSubmittedCurrentRound
  );

  useEffect(() => {
    if (workspaceViewedRef.current) {
      return;
    }

    workspaceViewedRef.current = true;
    trackGoal("case_workspace_viewed", {
      mode: analyticsMode,
      status: caseSession.status,
      category: caseSession.primaryCategory,
      complexity: caseSession.complexity,
      side: caseSession.playerSide,
    });
  }, [
    analyticsMode,
    caseSession.complexity,
    caseSession.playerSide,
    caseSession.primaryCategory,
    caseSession.status,
  ]);

  useEffect(() => {
    if (
      !isInterview ||
      intakeTourPromptedRef.current ||
      visibleInterviewTranscript.length > 0 ||
      typeof window === "undefined"
    ) {
      return;
    }

    intakeTourPromptedRef.current = true;

    if (window.localStorage.getItem(intakeTourStorageKey) === "true") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowIntakeTour(true);
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [isInterview, visibleInterviewTranscript.length]);

  useEffect(() => {
    if (
      !isSettlement ||
      settlementTourPromptedRef.current ||
      typeof window === "undefined"
    ) {
      return;
    }

    settlementTourPromptedRef.current = true;

    if (window.localStorage.getItem(settlementTourStorageKey) === "true") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSettlementTour(true);
    }, 650);

    return () => window.clearTimeout(timeoutId);
  }, [isSettlement]);

  const requestIntakeTour = useCallback(() => {
    trackGoal("tour_requested", {
      tour: "intake",
      source: "manual",
      ...tourAnalyticsContext,
    });
    setShowIntakeTour(true);
  }, [tourAnalyticsContext]);

  const requestSettlementTour = useCallback(() => {
    trackGoal("tour_requested", {
      tour: "settlement",
      source: "manual",
      ...tourAnalyticsContext,
    });
    setShowSettlementTour(true);
  }, [tourAnalyticsContext]);

  useEffect(() => {
    const cooldownUntil = caseSession.settlement?.cooldownUntil;
    if (!cooldownUntil || typeof window === "undefined") {
      return undefined;
    }

    const cooldownUntilTime = new Date(cooldownUntil).getTime();
    if (!Number.isFinite(cooldownUntilTime) || cooldownUntilTime <= Date.now()) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setSettlementCooldownNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [caseSession.settlement?.cooldownUntil]);

  useEffect(() => {
    if (
      analyticsMode !== "pvp" ||
      caseSession.status !== "courtroom" ||
      !caseSession.courtroomDeadlineAt ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCourtroomTimerNow(Date.now());
    }, 60000);

    setCourtroomTimerNow(Date.now());

    return () => window.clearInterval(intervalId);
  }, [analyticsMode, caseSession.courtroomDeadlineAt, caseSession.status]);

  useEffect(() => {
    if (!isInterview || !interviewTranscriptRef.current) {
      return;
    }

    interviewTranscriptRef.current.scrollTo({
      top: interviewTranscriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isInterview, visibleInterviewTranscript.length, working, pendingSpeaker]);

  useEffect(() => {
    if (isInterview || !courtroomTranscriptRef.current) {
      return;
    }

    courtroomTranscriptRef.current.scrollTo({
      top: courtroomTranscriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isInterview, normalizedCourtroomTranscript.length, working, pendingSpeaker]);

  useEffect(() => {
    if (!apiConfig.realtimeRefresh || isVerdict || isSettled || isExited || !realtimeRefreshPath) {
      return;
    }

    let cancelled = false;

    const refreshCase = async () => {
      if (cancelled || workingRef.current || document.hidden) {
        return;
      }

      try {
        const response = await apiClient.get(realtimeRefreshPath);
        if (!cancelled) {
          updateCaseFromResponseRef.current?.(response);
        }
      } catch (error) {
        console.error(error);
      }
    };

    const intervalId = window.setInterval(refreshCase, realtimeRefreshIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    apiConfig.realtimeRefresh,
    isVerdict,
    isSettled,
    isExited,
    realtimeRefreshIntervalMs,
    realtimeRefreshPath,
  ]);

  useEffect(() => {
    if (
      !apiConfig.realtimeRefresh ||
      isVerdict ||
      isSettled ||
      isExited ||
      !realtimeVersionPath ||
      !realtimeRefreshPath
    ) {
      return;
    }

    let cancelled = false;
    let checking = false;

    const refreshFromVersionSignal = async () => {
      if (cancelled || checking || workingRef.current || document.hidden) {
        return;
      }

      checking = true;

      try {
        const versionResponse = await apiClient.get(realtimeVersionPath);
        const nextVersionKey = buildRealtimeVersionKey(versionResponse?.version || {});

        if (
          nextVersionKey &&
          realtimeVersionKeyRef.current &&
          nextVersionKey !== realtimeVersionKeyRef.current
        ) {
          realtimeVersionKeyRef.current = nextVersionKey;
          const response = await apiClient.get(realtimeRefreshPath);
          if (!cancelled) {
            updateCaseFromResponseRef.current?.(response);
          }
        } else if (nextVersionKey && !realtimeVersionKeyRef.current) {
          realtimeVersionKeyRef.current = nextVersionKey;
        }
      } catch (error) {
        console.error(error);
      } finally {
        checking = false;
      }
    };

    const intervalId = window.setInterval(
      refreshFromVersionSignal,
      realtimeVersionIntervalMs
    );

    const handleFocus = () => {
      refreshFromVersionSignal();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshFromVersionSignal();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    refreshFromVersionSignal();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    apiConfig.realtimeRefresh,
    isVerdict,
    isSettled,
    isExited,
    realtimeRefreshPath,
    realtimeVersionIntervalMs,
    realtimeVersionPath,
  ]);

  const handleChatTextareaKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent?.isComposing) {
      return;
    }

    event.preventDefault();

    if (working || intakeActionsLocked) {
      return;
    }

    const form = event.currentTarget.form;
    if (!form) {
      return;
    }

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };

  const applySuggestedIntakeQuestion = (nextQuestion, { closeFactSheetDialog = false } = {}) => {
    if (intakeActionsLocked) {
      return;
    }

    setQuestion(nextQuestion);
    if (closeFactSheetDialog) {
      setShowMobileFactSheetDialog(false);
    }
  };

  const handleInterviewSubmit = async (event) => {
    event.preventDefault();
    if (settlementAuthorityReady) {
      await handleSendSettlementIntent();
      return;
    }

    if (working || intakeActionsLocked || !question.trim()) return;

    const submittedQuestion = question.trim();
    const previousFactSheet = caseSession.factSheet;
    trackGoal("intake_question_sent", caseAnalyticsParams({
      question_chars: submittedQuestion.length,
      transcript_count: visibleInterviewTranscript.length,
      intake_locked: intakeActionsLocked,
    }));

    setOptimisticTranscriptEntry({
      role: "player",
      speaker: "You",
      text: submittedQuestion,
      createdAt: new Date().toISOString(),
    });
    setQuestion("");
    setWorking(true);
    setPendingAction("interview");
    setPendingSpeaker(getPlayerInterviewSubjectName(caseSession));

    try {
      const response = await apiClient.post(
        `${getApiBasePath(caseSession)}/interview`,
        { question: submittedQuestion }
      );

      const nextCase = updateCaseFromResponse(response);
      const progressDelta = getFactSheetProgressDelta(
        previousFactSheet,
        nextCase?.factSheet
      );
      triggerFactSheetProgress(progressDelta);
      trackGoal("intake_question_answered", caseAnalyticsParams({
        question_chars: submittedQuestion.length,
      }));
    } catch (error) {
      setQuestion(submittedQuestion);
      trackGoal("intake_question_failed", caseAnalyticsParams({
        question_chars: submittedQuestion.length,
      }));
      console.error(error);
    } finally {
      setOptimisticTranscriptEntry(null);
      setPendingSpeaker("");
      setPendingAction("");
      setWorking(false);
    }
  };

  const handleFinalize = async () => {
    if (working || intakeActionsLocked) {
      return;
    }

    const factSheetPayload = buildFactSheetPayload();
    trackGoal("fact_sheet_finalize_started", caseAnalyticsParams({
      sections_complete: completedFactSheetItems,
      open_questions: suggestedQuestions.length,
    }));

    setFinalizeFeedback(null);
    setWorking(true);
    setPendingAction("finalize");

    try {
      const response = await apiClient.post(
        `${getApiBasePath(caseSession)}/${apiConfig.finalizePath || "finalize"}`,
        {
          factSheet: factSheetPayload,
        }
      );

      const nextCase = updateCaseFromResponse(response);
      trackGoal("fact_sheet_finalized", caseAnalyticsParams({
        next_status: nextCase?.status,
        sections_complete: completedFactSheetItems,
      }));
      const successMessage =
        apiConfig.finalizeSuccessMessage ||
        (nextCase?.status === "courtroom"
          ? "Fact sheet finalized. Court is open."
          : "Fact sheet finalized.");
      setFinalizeFeedback({ tone: "success", text: successMessage });
      toast.success(successMessage);
    } catch (error) {
      trackGoal("fact_sheet_finalize_failed", caseAnalyticsParams({
        sections_complete: completedFactSheetItems,
      }));
      setFinalizeFeedback({
        tone: "error",
        text: error?.message || "Could not finalize the fact sheet.",
      });
      console.error(error);
    } finally {
      setPendingAction("");
      setWorking(false);
    }
  };

  function getSettlementOutgoingMessage(messageOverride = "") {
    return String(messageOverride || "").trim() || settlementMessage.trim() || settlementDraftMessage;
  }

  const submitSettlementMessage = async ({
    initial = false,
    messageOverride = "",
    acceptTerms = false,
    termsOverride = null,
  } = {}) => {
    const outgoingMessage = getSettlementOutgoingMessage(messageOverride).trim();
    if (
      working ||
      isIntakeLocked ||
      awaitingSettlementResponse ||
      awaitingNegotiationResponse ||
      !canSettleCase ||
      isSettlementCooldownActive ||
      !outgoingMessage
    ) {
      trackGoal("settlement_message_blocked", caseAnalyticsParams({
        initial,
        working,
        is_intake_locked: isIntakeLocked,
        awaiting_settlement_response: awaitingSettlementResponse,
        awaiting_negotiation_response: awaitingNegotiationResponse,
        can_settle_case: canSettleCase,
        cooldown_active: isSettlementCooldownActive,
        has_message: Boolean(outgoingMessage),
      }));
      return;
    }

    const submittedMessage = outgoingMessage;
    setSettlementRejected(false);
    setWorking(true);
    setPendingAction(acceptTerms ? "settlement-accept" : initial ? "settlement-start" : "settlement");
    trackGoal("settlement_message_submit_started", caseAnalyticsParams({
      initial,
      message_chars: submittedMessage.length,
      settlement_status: settlement.status,
      awaiting_negotiation_response: awaitingNegotiationResponse,
      negotiation_turn_user_id: settlement.negotiationTurnUserId || "",
      viewer_user_id: caseSession.playerUserId || "",
      accept_terms: acceptTerms,
    }));

    try {
      const response = await apiClient.post(
        `${getApiBasePath(caseSession)}/settlement/${initial ? "start" : "message"}`,
        {
          message: submittedMessage,
          terms: termsOverride || Object.fromEntries(editableSettlementTerms),
          acceptTerms,
        }
      );
      let responseForState = response;
      let serverSettlement =
        response?.challenge?.settlement || response?.caseSession?.settlement || {};
      const missingPendingIntentConfirmation =
        initial &&
        analyticsMode === "pvp" &&
        !(
          serverSettlement.intentPending === true ||
          serverSettlement.intentStatus === "pending" ||
          serverSettlement.status === "proposed"
        );

      if (missingPendingIntentConfirmation && realtimeRefreshPath) {
        const refreshedResponse = await apiClient.get(realtimeRefreshPath);
        const refreshedSettlement =
          refreshedResponse?.challenge?.settlement ||
          refreshedResponse?.caseSession?.settlement ||
          {};

        if (
          refreshedSettlement.intentPending === true ||
          refreshedSettlement.intentStatus === "pending" ||
          refreshedSettlement.status === "proposed"
        ) {
          responseForState = refreshedResponse;
          serverSettlement = refreshedSettlement;
        } else {
          throw new Error(
            "Settlement intent was not saved. Please try sending it again."
          );
        }
      }

      const serverStatus =
        responseForState?.challenge?.status || responseForState?.caseSession?.status;
      const serverSettlementStatus =
        serverSettlement.status ||
        responseForState?.challenge?.settlement?.status ||
        responseForState?.caseSession?.settlement?.status;
      const responseCaseStatus =
        responseForState?.challenge?.displayStatus ||
        responseForState?.caseSession?.status ||
        "";
      const shouldOptimisticallyWaitForPvpResponse =
        analyticsMode === "pvp" &&
        !initial &&
        (serverStatus === "settlement" ||
          responseCaseStatus === "settlement" ||
          serverSettlementStatus === "active") &&
        !["settled", "failed"].includes(serverSettlementStatus);
      const optimisticNegotiationTurnFields = {
        awaitingNegotiationResponse: true,
        receivedNegotiationMessage: false,
        latestNegotiationMessageByViewer: true,
        latestNegotiationMessageUserId: caseSession.playerUserId || "",
        awaitingNegotiationResponseUserId: caseSession.playerUserId || "",
        negotiationTurnUserId: caseSession.opponentUserId || "",
      };
      responseForState =
        shouldOptimisticallyWaitForPvpResponse
          ? {
              ...responseForState,
              ...(responseForState?.challenge
                ? {
                    challenge: {
                      ...responseForState.challenge,
                      settlement: {
                        ...(responseForState.challenge.settlement || {}),
                        status: responseForState.challenge.settlement?.status || "active",
                        ...optimisticNegotiationTurnFields,
                      },
                    },
                  }
                : {}),
              ...(responseForState?.caseSession
                ? {
                    caseSession: {
                      ...responseForState.caseSession,
                      settlement: {
                        ...(responseForState.caseSession.settlement || {}),
                        status: responseForState.caseSession.settlement?.status || "active",
                        ...optimisticNegotiationTurnFields,
                      },
                    },
                  }
                : {}),
            }
          : responseForState;
      const nextCase = updateCaseFromResponse(responseForState);
      setSettlementMessage("");
      setSettlementDraftState((current) => ({
        ...current,
        dirty: false,
      }));
      if (
        nextCase?.settlement?.resolution === "failed" &&
        nextCase?.settlement?.endedByViewer
      ) {
        setShowClientWalkoutModal(true);
        setClientWalkoutCountdown(5);
      }

      if (response?.rejected || nextCase?.settlement?.status === "rejected") {
        setSettlementRejected(true);
      } else {
        setShowSettlementDialog(false);
        setShowSettlementComposeModal(false);
        if (nextCase?.status === "settlement" && typeof window !== "undefined") {
          router.replace(getSettlementHref(nextCase));
        }
        toast.success(
          nextCase?.status === "settled"
            ? "Settlement reached."
            : nextCase?.settlement?.resolution === "failed"
            ? nextCase?.settlement?.endedByViewer
              ? "Your client wants to walk out."
              : "Opponent walked out. Intake is open again."
            : shouldOptimisticallyWaitForPvpResponse
            ? "Settlement message sent. Waiting for opposing counsel."
            : nextCase?.status === "settlement"
            ? "Settlement talks are open."
            : nextCase?.settlement?.status === "proposed"
            ? "Settlement intent sent. Waiting for opposing counsel."
            : "Settlement message sent."
        );
      }
      trackGoal("settlement_message_submit_succeeded", caseAnalyticsParams({
        initial,
        message_chars: submittedMessage.length,
        next_status: nextCase?.status || "",
        next_settlement_status: nextCase?.settlement?.status || "",
        awaiting_negotiation_response: Boolean(
          nextCase?.settlement?.awaitingNegotiationResponse
        ),
        received_negotiation_message: Boolean(
          nextCase?.settlement?.receivedNegotiationMessage
        ),
      }));
    } catch (error) {
      toast.error(error?.message || "Could not send settlement message.");
      trackGoal("settlement_message_submit_failed", caseAnalyticsParams({
        initial,
        message_chars: submittedMessage.length,
        error: error?.message || "unknown",
      }));
      console.error(error);
    } finally {
      setPendingAction("");
      setWorking(false);
    }
  };

  function getDefaultSettlementIntentMessage() {
    return `${playerPartyName} consents to exploring settlement. Please ask your client whether they consent so we can move into settlement talks.`;
  }

  const handleSendSettlementIntent = async () => {
    if (
      working ||
      isIntakeLocked ||
      awaitingSettlementResponse ||
      !canSettleCase ||
      isSettlementCooldownActive ||
      pendingSettlementIntentFromViewer ||
      !hasSettlementAuthority
    ) {
      return;
    }

    await submitSettlementMessage({
      initial: true,
      messageOverride: getDefaultSettlementIntentMessage(),
    });
  };

  const handleSettlementStartSubmit = async (event) => {
    event.preventDefault();
    await submitSettlementMessage({ initial: true });
  };

  const handleOpenSettlementDialog = async ({ openDialog = true } = {}) => {
    if (
      working ||
      isIntakeLocked ||
      awaitingSettlementResponse ||
      !canSettleCase ||
      isSettlementCooldownActive ||
      pendingSettlementIntentFromViewer ||
      !hasSettlementAuthority
    ) {
      return;
    }

    setSettlementRejected(false);
    setSettlementMessage("");
    if (openDialog) {
      setShowSettlementDialog(true);
    }
    setWorking(true);
    setPendingAction("settlement-draft");

    try {
      const response = await apiClient.post(`${getApiBasePath(caseSession)}/settlement/draft`);
      setSettlementMessage(response?.message || "");
    } catch (error) {
      toast.error(error?.message || "Could not draft a settlement message.");
      console.error(error);
    } finally {
      setPendingAction("");
      setWorking(false);
    }
  };

  const handleSettlementMessageSubmit = async (event) => {
    event.preventDefault();
    if (recordingSettlementMessage || transcribingSettlementMessage || !settlementMessage.trim()) {
      return;
    }

    await submitSettlementMessage({ messageOverride: settlementMessage.trim() });
  };

  const handleAcceptSettlementIntent = async () => {
    await submitSettlementMessage({
      initial: true,
      messageOverride:
        "My client consents to settlement talks. We accept the settlement intent and are ready to discuss practical terms.",
    });
  };

  const handleRejectSettlementIntent = async () => {
    if (working || !canSettleCase || !hasSettlementRejection) {
      return;
    }

    setSettlementRejected(false);
    setWorking(true);
    setPendingAction("settlement-reject");

    try {
      const response = await apiClient.post(
        `${getApiBasePath(caseSession)}/settlement/exit`
      );
      updateCaseFromResponse(response);
      toast.success("Settlement intent rejected.");
    } catch (error) {
      toast.error(error?.message || "Could not reject settlement intent.");
      console.error(error);
    } finally {
      setPendingAction("");
      setWorking(false);
    }
  };

  const handleSettlementExit = async () => {
    setSettlementRejected(false);
    setShowSettlementDialog(false);
    setWorking(true);
    setPendingAction("settlement-exit");

    try {
      const response = await apiClient.post(
        `${getApiBasePath(caseSession)}/settlement/exit`
      );
      updateCaseFromResponse(response);
      toast.success(analyticsMode === "pvp" ? "Settlement negotiations ended." : "Returned to intake.");
    } catch (error) {
      toast.error(error?.message || "Could not end settlement negotiations.");
      console.error(error);
    } finally {
      setPendingAction("");
      setWorking(false);
    }
  };

  const handleCourtroomSubmit = async (event) => {
    event.preventDefault();
    if (working || showCourtroomWaitingCard || courtroomTimeoutPending || !argument.trim()) return;

    const submittedArgument = argument.trim();
    trackGoal("courtroom_argument_sent", caseAnalyticsParams({
      argument_chars: submittedArgument.length,
      round: caseSession.score.roundsCompleted + 1,
      waiting_card: showCourtroomWaitingCard,
    }));

    setOptimisticTranscriptEntry({
      round: caseSession.score.roundsCompleted + 1,
      speaker: "player",
      text: submittedArgument,
      citedFacts: [],
      citedRules: [],
      citedClaimIds: [],
      createdAt: new Date().toISOString(),
    });
    setArgument("");
    setWorking(true);
    setPendingAction("courtroom");
    setPendingSpeaker(apiConfig.courtroomSubmitOnly ? "" : getOpponentPartyName(caseSession));

    try {
      const response = await apiClient.post(
        `${getApiBasePath(caseSession)}/courtroom`,
        { argument: submittedArgument }
      );

      updateCaseFromResponse(response);
      trackGoal("courtroom_argument_scored", caseAnalyticsParams({
        argument_chars: submittedArgument.length,
        round: caseSession.score.roundsCompleted + 1,
      }));
    } catch (error) {
      setArgument(submittedArgument);
      trackGoal("courtroom_argument_failed", caseAnalyticsParams({
        argument_chars: submittedArgument.length,
        round: caseSession.score.roundsCompleted + 1,
      }));
      console.error(error);
    } finally {
      setOptimisticTranscriptEntry(null);
      setPendingSpeaker("");
      setPendingAction("");
      setWorking(false);
    }
  };

  const handleExitCase = async () => {
    if (awaitingSettlementResponse) {
      return;
    }

    const exitConfirmMessage =
      isCourtroom && analyticsMode === "pvp"
        ? "Quit this PVP challenge? You will lose immediately."
        : isCourtroom
        ? "Quit this court case? You will lose immediately."
        : apiConfig.exitConfirm ||
          "Exit this intake? This generated matter will be closed, but you can start a fresh case immediately.";
    const confirmed = window.confirm(
      exitConfirmMessage
    );

    if (!confirmed) {
      trackGoal("case_exit_cancelled", caseAnalyticsParams());
      return;
    }

    trackGoal("case_exit_confirmed", caseAnalyticsParams());
    setWorking(true);
    setPendingAction("exit");

    try {
      const response = await apiClient.post(
        `${getApiBasePath(caseSession)}/${apiConfig.exitPath || "exit"}`
      );

      if (apiConfig.exitStaysInWorkspace || response?.caseSession?.status === "verdict") {
        updateCaseFromResponse(response);
      } else {
        startNavigationLoading(apiConfig.exitLoadingLabel || "Returning to the docket");
        router.push(apiConfig.exitRedirect || "/dashboard");
        router.refresh();
      }
      trackGoal("case_exit_completed", caseAnalyticsParams());
    } catch (error) {
      trackGoal("case_exit_failed", caseAnalyticsParams());
      console.error(error);
    } finally {
      setPendingAction("");
      setWorking(false);
    }
  };

  const playerPartyName = getPlayerPartyName(caseSession);
  const playerInterviewSubjectName = getPlayerInterviewSubjectName(caseSession);
  const getInterviewEntrySpeaker = (entry) => {
    if (entry.role === "player") {
      return entry.speaker || "You";
    }

    const speaker = String(entry.speaker || "").trim();
    return speaker && !isGenericInterviewSubjectName(speaker)
      ? speaker
      : playerInterviewSubjectName;
  };
  const mobileInterviewExchangePairs = useMemo(() => {
    const pairs = [];
    let pendingQuestion = null;

    visibleInterviewTranscript.forEach((entry, index) => {
      if (entry.role === "player") {
        pendingQuestion = { entry, index };
        return;
      }

      if (pendingQuestion) {
        pairs.push({
          id: `${pendingQuestion.entry.createdAt || pendingQuestion.index}-${
            entry.createdAt || index
          }`,
          question: pendingQuestion.entry,
          response: entry,
        });
        pendingQuestion = null;
      }
    });

    if (pendingQuestion) {
      pairs.push({
        id: `${pendingQuestion.entry.createdAt || pendingQuestion.index}-pending`,
        question: pendingQuestion.entry,
        response: null,
      });
    }

    return pairs;
  }, [visibleInterviewTranscript]);
  const latestMobileInterviewExchange =
    mobileInterviewExchangePairs[mobileInterviewExchangePairs.length - 1] || null;
  const mobileInterviewExchangeHistory = mobileInterviewExchangePairs.slice(0, -1);
  const latestEvidenceProductionQuestions =
    latestMobileInterviewExchange?.response &&
    shouldPromptForEvidenceProduction(latestMobileInterviewExchange.response.text)
      ? getEvidenceFollowUpQuestions(latestMobileInterviewExchange.response.text)
      : [];
  const opponentPartyName = getOpponentPartyName(caseSession);
  const defendantName = getDefendantName(caseSession);
  const isDefendantSide =
    caseSession.playerSide === "opponent" ||
    playerPartyName.trim().toLowerCase() === defendantName.trim().toLowerCase();
  const waitingForPlaintiffOpening = Boolean(
    apiConfig.requirePlaintiffOpening &&
      isDefendantSide &&
      caseSession.score.roundsCompleted === 0 &&
      !viewerSubmittedCurrentRound &&
      !opponentSubmittedCurrentRound
  );
  const lastCourtroomEntry =
    normalizedCourtroomTranscript[normalizedCourtroomTranscript.length - 1] || null;
  const latestCourtroomRound = Math.max(
    0,
    ...normalizedCourtroomTranscript.map((entry) => Number(entry.round) || 0)
  );
  const displayedCourtroomRound = Math.max(
    1,
    Math.min(
      caseSession.maxCourtRounds || 1,
      latestCourtroomRound || caseSession.score.roundsCompleted || 1
    )
  );
  const lastCourtroomEntryWasViewer =
    typeof lastCourtroomEntry?.submittedByViewer === "boolean"
      ? lastCourtroomEntry.submittedByViewer
      : lastCourtroomEntry?.speaker === "player";
  const waitingForOpponentResponse = Boolean(
    apiConfig.turnBasedCourtroom &&
      ((viewerSubmittedCurrentRound && !opponentSubmittedCurrentRound) ||
        (!viewerSubmittedCurrentRound && lastCourtroomEntryWasViewer))
  );
  const showCourtroomWaitingCard = Boolean(
    !isVerdict &&
      (waitingForPlaintiffOpening ||
        viewerSubmittedCurrentRound ||
        waitingForOpponentResponse)
  );
  const playerRoleLabel =
    caseSession.playerSide === "opponent" ? "Defendant" : "Plaintiff";
  const opponentRoleLabel =
    caseSession.playerSide === "opponent" ? "Plaintiff" : "Defendant";
  const showPvpCounselNames = analyticsMode === "pvp";
  const opponentCounselLabel =
    String(caseSession.opponentCounselName || "").trim() || "Opposing lawyer";
  const courtroomWaitingMessage = waitingForPlaintiffOpening
    ? `${opponentPartyName} has the opening statement. Waiting for ${opponentCounselLabel} to file.`
    : `${opponentPartyName} is preparing a response...`;
  const sideBadgeLabel = `Representing ${playerPartyName}`;
  const sideContextLabel = `${playerRoleLabel} side`;
  const playerRepresentationLabel = `You represent ${playerPartyName} (${playerRoleLabel}).`;
  const interviewContextLabel = isInterview
    ? `Interviewing ${playerInterviewSubjectName}.`
    : showPvpCounselNames
    ? `${opponentCounselLabel} represents ${opponentPartyName}.`
    : `Opposing counsel represents ${opponentPartyName}.`;
  const verdictStyle =
    verdictTone[caseSession.verdict?.winner] || verdictTone.draw;
  const verdictIsPlayerWin = caseSession.verdict?.winner === "player";
  const verdictIsOpponentWin = caseSession.verdict?.winner === "opponent";
  const verdictAccentClass = verdictIsPlayerWin
    ? "text-emerald-100"
    : verdictIsOpponentWin
    ? "text-rose-100"
    : "text-amber-100";
  const verdictGlowClass = verdictIsPlayerWin
    ? "from-emerald-500/18 via-emerald-500/5"
    : verdictIsOpponentWin
    ? "from-rose-500/18 via-rose-500/5"
    : "from-amber-500/18 via-amber-500/5";
  const verdictPillClass = verdictIsPlayerWin
    ? "border-emerald-300/35 bg-emerald-300/12 text-emerald-100"
    : verdictIsOpponentWin
    ? "border-rose-300/35 bg-rose-300/12 text-rose-100"
    : "border-amber-300/35 bg-amber-300/12 text-amber-100";
  const verdictKeyIssue =
    caseSession.verdict?.concerns?.[0] ||
    caseSession.verdict?.highlights?.[0] ||
    caseSession.score.lastBenchSignal ||
    "The record was close on the decisive issue.";
  const lawbookRules =
    Array.isArray(caseSession.lawbook) && caseSession.lawbook.length >= legalArenaLawbook.length
      ? caseSession.lawbook
      : legalArenaLawbook;
  const visibleLawbookRules = useMemo(() => {
    const categoryRules = filterLawbookRulesByCategory(
      lawbookRules,
      selectedLawbookCategory
    );
    const searchTerm = lawbookSearch.trim().toLowerCase();

    if (!searchTerm) {
      return categoryRules;
    }

    return categoryRules.filter((rule) =>
      [
        rule.title,
        rule.principle,
        rule.guidance,
        rule.id,
        ...(rule.tags || []),
        ...(rule.categorySlugs || []).map((slug) => categoryTitleBySlug.get(slug) || slug),
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm)
    );
  }, [lawbookRules, lawbookSearch, selectedLawbookCategory]);
  const selectedLawbookCategoryTitle =
    selectedLawbookCategory === LAWBOOK_ALL_CATEGORIES
      ? "All"
      : categoryTitleBySlug.get(selectedLawbookCategory) || "Case category";

  const pressureTotal = Math.max(caseSession.score.player + caseSession.score.opponent, 1);
  const playerPressurePct = clampPercent((caseSession.score.player / pressureTotal) * 100);
  const opponentPressurePct = clampPercent(
    (caseSession.score.opponent / pressureTotal) * 100
  );
  const opponentCounselPortrait = String(caseSession.opponentImage || "").trim();
  const playerCounselPortrait =
    String(caseSession.playerImage || "").trim() || "/images/profile.jpg";
  const opponentCourtPortrait =
    (showPvpCounselNames ? opponentCounselPortrait : "") || "/images/profile.jpg";
  const playerCourtPortrait = playerCounselPortrait;

  const courtroomStageLabel = useMemo(() => {
    if (isExited) return "Exited";
    if (isInterview) return "Party Intake";
    if (isSettlement) return "Settlement";
    if (isSettled) return "Settled";
    if (isVerdict) return "Verdict";
    return `Courtroom Round ${displayedCourtroomRound}`;
  }, [displayedCourtroomRound, isExited, isInterview, isSettlement, isSettled, isVerdict]);

  const suggestedQuestions = (caseSession.factSheet.openQuestions || []).slice(0, 4);
  const factSheetCompletionItems = [
    factSheetDraft.theory,
    factSheetDraft.timeline,
    factSheetDraft.supportingFacts,
    factSheetDraft.risks,
    factSheetDraft.disputedFacts,
    factSheetDraft.corroboratedFacts,
    factSheetDraft.missingEvidence,
    factSheetDraft.desiredRelief,
  ];
  const completedFactSheetItems = factSheetCompletionItems.filter((item) =>
    cleanDraftList(item).length > 0
  ).length;
  const factSheetProgressPercent = clampPercent(
    (completedFactSheetItems / factSheetCompletionItems.length) * 100
  );
  const roundedFactSheetProgressPercent = Math.round(factSheetProgressPercent);
  const nextFactSheetStep =
    (!cleanDraftList(factSheetDraft.theory).length && "Shape the case theory") ||
    (!cleanDraftList(factSheetDraft.timeline).length && "Add timeline of events") ||
    (!cleanDraftList(factSheetDraft.supportingFacts).length && "Capture supporting facts") ||
    (!cleanDraftList(factSheetDraft.risks).length &&
      !cleanDraftList(factSheetDraft.disputedFacts).length &&
      "Document a key risk or dispute") ||
    (!cleanDraftList(factSheetDraft.desiredRelief).length && "Add requested relief") ||
    "Review and finalize fact sheet";
  const isCourtroom = !isInterview && !isSettlement && !isSettled && !isExited && !isVerdict;
  const courtroomDeadlineTime = caseSession.courtroomDeadlineAt
    ? new Date(caseSession.courtroomDeadlineAt).getTime()
    : null;
  const courtroomDeadlineRemainingMs =
    analyticsMode === "pvp" && Number.isFinite(Number(courtroomDeadlineTime))
      ? Math.max(0, Number(courtroomDeadlineTime) - courtroomTimerNow)
      : null;
  const courtroomDeadlineExpired =
    analyticsMode === "pvp" &&
    Number.isFinite(Number(courtroomDeadlineTime)) &&
    Number(courtroomDeadlineTime) <= courtroomTimerNow;
  const courtroomTimeoutPending = Boolean(
    analyticsMode === "pvp" &&
      isCourtroom &&
      (courtroomDeadlineExpired || caseSession.courtroomTimeoutFinalizingAt)
  );
  const courtroomDeadlineLabel = courtroomTimeoutPending
    ? "Court is preparing a timeout verdict"
    : courtroomDeadlineRemainingMs !== null
    ? `Response due in ${Math.floor(courtroomDeadlineRemainingMs / 3600000)}h ${Math.floor(
        (courtroomDeadlineRemainingMs % 3600000) / 60000
      )}m`
    : "";
  const courtroomRoundLabel = `Courtroom Round ${displayedCourtroomRound}`;
  const assessment = caseSession.caseAssessment || {};
  const displayedSuccessChance = isInterview
    ? assessment.currentSuccessChance
    : assessment.lockedCourtEntryChance ?? assessment.currentSuccessChance;
  const successChanceReasons = isInterview
    ? assessment.currentReasons || []
    : assessment.lockedReasons?.length
    ? assessment.lockedReasons
    : assessment.currentReasons || [];
  const successChanceLabel =
    successChanceReasons.length > 0
      ? `Success chance factors: ${successChanceReasons.join("; ")}`
      : isInterview
      ? "Updates after client answers."
      : "Locked when the case entered court.";
  const heroNarrativeExcerpt =
    cleanIntakePartySpeech(caseSession.clientMemoryExcerpt) ||
    cleanIntakePartySpeech(caseSession.premise?.openingStatement) ||
    cleanIntakePartySpeech(caseSession.premise?.overview);
  const firstDraftItem = (...lists) =>
    lists.flatMap((list) => cleanDraftList(list)).find(Boolean) || "";

  const sentenceCasePartyName = (partyName = "") => {
    const trimmed = String(partyName || "").trim();
    if (!trimmed) return "";
    if (/^(the|a|an)\s+/i.test(trimmed)) return trimmed;
    if (/^(state|commonwealth|people|city|county|united states)\b/i.test(trimmed)) {
      return `the ${trimmed}`;
    }
    return trimmed;
  };

  const capitalizeSentenceStart = (value = "") => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  };

  const lowerSentenceContinuation = (value = "") => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (/^[A-Z]\b/.test(trimmed)) return trimmed;
    return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
  };

  const punctuateSentence = (value = "") => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  };

  const reliefSnippet = ({ partyName, relief }) => {
    const trimmedRelief = String(relief || "").trim();
    if (!trimmedRelief) return "";

    if (/\b(asks?|seeks?|requests?|moves?)\b/i.test(trimmedRelief)) {
      return punctuateSentence(trimmedRelief);
    }

    return punctuateSentence(
      `For that reason, ${capitalizeSentenceStart(
        sentenceCasePartyName(partyName)
      )} asks for ${lowerSentenceContinuation(trimmedRelief).replace(
        /^return of\b/i,
        "the return of"
      )}`
    );
  };

  const courtFactText = (value = "") =>
    String(value || "")
      .trim()
      .replace(/^the\s+evidence\s+will\s+show\s+that\s+/i, "")
      .replace(/^the\s+fact\s+sheet\s+supports\s+this\s+point:\s*/i, "")
      .replace(/^(the\s+)?(plaintiff|tenant|claimant|client|defendant|landlord)\s+will\s+(argue|claim|contend)\s+that\s+/i, "")
      .replace(/^[a-z][a-z\s.'-]*'s\s+view\s+is\s+that\s+/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  const appendArgumentSnippet = (snippet) => {
    const text = String(snippet || "").trim();

    if (!text) {
      return;
    }

    setArgument((current) => {
      const trimmedCurrent = String(current || "").trim();
      return trimmedCurrent ? `${trimmedCurrent}\n\n${text}` : text;
    });
  };

  const openingStatementSnippet = () => {
    const theory = firstDraftItem(factSheetDraft.theory, factSheetDraft.summary);
    const strongestFact = firstDraftItem(
      factSheetDraft.corroboratedFacts,
      factSheetDraft.supportingFacts,
      factSheetDraft.timeline
    );
    const liveRisk = firstDraftItem(factSheetDraft.risks, factSheetDraft.disputedFacts);
    const relief = firstDraftItem(factSheetDraft.desiredRelief);
    const rule =
      visibleLawbookRules.find((item) => !item.universal) || visibleLawbookRules[0];

    return [
      `May it please the Court. I represent ${sentenceCasePartyName(playerPartyName)}.`,
      theory ? punctuateSentence(courtFactText(theory)) : "",
      strongestFact
        ? `The evidence supports that ${lowerSentenceContinuation(
            courtFactText(strongestFact)
          )}`
        : "",
      rule ? `Under ${rule.title}, ${rule.principle}` : "",
      liveRisk
        ? `The other side may point to ${lowerSentenceContinuation(
            courtFactText(liveRisk)
          )}, but that does not defeat the relief requested.`
        : "",
      reliefSnippet({ partyName: playerPartyName, relief }),
    ]
      .filter(Boolean)
      .join("\n");
  };

  const strongestFactSnippet = () => {
    const fact = firstDraftItem(
      factSheetDraft.corroboratedFacts,
      factSheetDraft.supportingFacts,
      factSheetDraft.timeline
    );

    return fact
      ? `The evidence supports that ${lowerSentenceContinuation(courtFactText(fact))}`
      : "";
  };

  const riskResponseSnippet = () => {
    const risk = firstDraftItem(factSheetDraft.risks, factSheetDraft.disputedFacts);
    const support = firstDraftItem(factSheetDraft.corroboratedFacts, factSheetDraft.supportingFacts);

    if (!risk) {
      return "";
    }

    return support
      ? `The other side may emphasize ${lowerSentenceContinuation(
          courtFactText(risk)
        )}.\nBut the stronger point for my client is that ${lowerSentenceContinuation(
          courtFactText(support)
        )}`
      : `The other side may emphasize ${lowerSentenceContinuation(
          courtFactText(risk)
        )}, but that does not carry the day.`;
  };

  const proofGapSnippet = () => {
    const gap = firstDraftItem(factSheetDraft.missingEvidence);

    return gap
      ? `The Court need not speculate about ${lowerSentenceContinuation(
          courtFactText(gap)
        )}.\nOn the evidence before the Court, the requested relief is still supported.`
      : "";
  };

  const lawbookSnippet = () => {
    const rule =
      visibleLawbookRules.find((item) => !item.universal) || visibleLawbookRules[0];

    return rule ? `Under ${rule.title}, ${rule.principle}` : "";
  };

  const argumentQuickTools = [
    ["Opening statement", openingStatementSnippet()],
    ["Add strongest fact", strongestFactSnippet()],
    ["Address risk", riskResponseSnippet()],
    ["Handle proof gap", proofGapSnippet()],
    ["Cite lawbook", lawbookSnippet()],
  ].filter((tool) => tool[1]);
  const lastOpponentCourtEntry = [...normalizedCourtroomTranscript]
    .reverse()
    .find((entry) => entry.speaker !== "player");
  const lastPlayerCourtEntry = [...normalizedCourtroomTranscript]
    .reverse()
    .find((entry) => entry.speaker === "player");
  const lastOpponentCourtEntryKey = lastOpponentCourtEntry
    ? `${lastOpponentCourtEntry.round || ""}-${lastOpponentCourtEntry.text || ""}`
    : "";
  const lastOpponentCourtEntryDisplayRound = Math.max(
    Number(lastOpponentCourtEntry?.round || 0),
    displayedCourtroomRound
  );
  const lastPlayerCourtEntryDisplayRound = Math.max(
    Number(lastPlayerCourtEntry?.round || 0),
    displayedCourtroomRound
  );
  const showSubmittedPlayerCourtEntry = Boolean(
    showCourtroomWaitingCard && lastPlayerCourtEntry
  );
  const mobileOpponentArgumentCanExpand =
    String(lastOpponentCourtEntry?.text || "").length > 160 ||
    String(lastOpponentCourtEntry?.text || "").includes("\n");
  const courtroomFocusItems = [
    firstDraftItem(factSheetDraft.theory),
    firstDraftItem(factSheetDraft.risks, factSheetDraft.disputedFacts),
    firstDraftItem(factSheetDraft.corroboratedFacts, factSheetDraft.supportingFacts),
  ].filter(Boolean).slice(0, 3);
  useEffect(() => {
    setShowFullMobileOpponentArgument(false);
  }, [lastOpponentCourtEntryKey]);

  const settlement = caseSession.settlement || {};
  const settlementCooldownUntilTime = settlement.cooldownUntil
    ? new Date(settlement.cooldownUntil).getTime()
    : NaN;
  const settlementCooldownRemainingMs = Number.isFinite(settlementCooldownUntilTime)
    ? Math.max(0, settlementCooldownUntilTime - settlementCooldownNow)
    : 0;
  const isSettlementCooldownActive = settlementCooldownRemainingMs > 0;
  const settlementCooldownLabel = formatSettlementCooldown(settlementCooldownRemainingMs);
  const isPendingSettlementIntent =
    isInterview &&
    (settlement.intentPending === true ||
      settlement.intentStatus === "pending" ||
      settlement.status === "proposed");
  const pendingSettlementIntentFromViewer =
    isPendingSettlementIntent &&
    Boolean(
      settlement.intentSentByViewer ||
        settlement.awaitingSettlementResponse ||
        settlement.proposedByViewer
    );
  const pendingSettlementIntentFromOther =
    isPendingSettlementIntent &&
    Boolean(
      settlement.intentReceivedByViewer ||
        settlement.receivedSettlementIntent ||
        !pendingSettlementIntentFromViewer
    );
  const awaitingSettlementResponse =
    isPendingSettlementIntent && pendingSettlementIntentFromViewer;
  const settlementEndedByOther =
    isInterview &&
    settlement.endedNegotiations === true &&
    settlement.endedByOther === true &&
    (["rejected", "failed"].includes(settlement.status) ||
      settlement.resolution === "failed");
  const viewerUserId = normalizeIdForCompare(caseSession.playerUserId);
  const negotiationTurnUserId = normalizeIdForCompare(settlement.negotiationTurnUserId);
  const awaitingNegotiationResponseUserId = normalizeIdForCompare(
    settlement.awaitingNegotiationResponseUserId
  );
  const awaitingNegotiationResponse =
    isSettlement &&
    (idsMatch(awaitingNegotiationResponseUserId, viewerUserId) ||
      (!awaitingNegotiationResponseUserId && Boolean(settlement.awaitingNegotiationResponse)));
  const receivedNegotiationMessage =
    isSettlement &&
    (idsMatch(negotiationTurnUserId, viewerUserId) ||
      (!negotiationTurnUserId && Boolean(settlement.receivedNegotiationMessage)));
  const settlementAuthorityReady =
    isInterview &&
    canSettleCase &&
    hasSettlementAuthority &&
    !isPendingSettlementIntent &&
    !isSettlementCooldownActive &&
    !["active", "rejected", "failed", "settled"].includes(settlement.status);
  const intakeActionsLocked =
    isIntakeLocked || awaitingSettlementResponse || settlementAuthorityReady;

  useEffect(() => {
    if (awaitingSettlementResponse || awaitingNegotiationResponse) {
      setShowSettlementDialog(false);
      setShowSettlementComposeModal(false);
    }
  }, [awaitingNegotiationResponse, awaitingSettlementResponse]);

  const settlementMoods = settlement.moods || {};
  const settlementOwnSide = caseSession.playerSide === "opponent" ? "opponent" : "client";
  const settlementOtherSide = settlementOwnSide === "opponent" ? "client" : "opponent";
  const getSettlementMoodValueForSide = (side) => {
    const value = Number(side === "opponent" ? settlementMoods.opponent : settlementMoods.player);
    return Number.isFinite(value) ? value : 0;
  };
  const settlementTranscript = settlement.transcript || [];
  const settlementHumanTranscript =
    analyticsMode === "pvp"
      ? settlementTranscript.filter((entry) => entry?.role === "player")
      : settlementTranscript;
  const settlementIsTerminal = Boolean(
    isSettled ||
      settlement.resolved ||
      settlement.accepted ||
      settlement.resolution ||
      ["settled", "failed"].includes(settlement.status)
  );
  const settlementCaseRouteRef = getCaseRouteRef(caseSession);
  const opponentPortraitImage = caseSession.opponentPortrait?.image;
  useEffect(() => {
    if (!(isSettlement || isSettled) || opponentPortraitImage) {
      return;
    }

    const caseRef = settlementCaseRouteRef;
    const requestKey = `${caseRef}:opponent`;

    if (!caseRef || requestedOpponentPortraitRef.current.has(requestKey)) {
      return;
    }

    let cancelled = false;
    requestedOpponentPortraitRef.current.add(requestKey);

    const generateOpponentPortrait = async () => {
      try {
        const portraitApiBasePath = apiConfig.basePath || `/cases/${caseRef}`;
        const response = await apiClient.post(
          `${portraitApiBasePath}/client-portrait?target=opponent`
        );

        if (!cancelled) {
          updateCaseFromResponseRef.current?.(response);
        }
      } catch (error) {
        console.error("Opponent portrait generation failed", error);
      }
    };

    generateOpponentPortrait();

    return () => {
      cancelled = true;
    };
  }, [
    apiConfig.basePath,
    opponentPortraitImage,
    settlementCaseRouteRef,
    isSettled,
    isSettlement,
  ]);
  useEffect(() => {
    const hasReachedSettlement = isSettled || settlement.status === "settled";

    if (!hasReachedSettlement) {
      settlementResolvedRef.current = false;
      return;
    }

    if (settlementResolvedRef.current) {
      return;
    }

    settlementResolvedRef.current = true;
    window.requestAnimationFrame(() => {
      settlementTopRef.current?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    });
  }, [isSettled, settlement.status]);
  const playerSettlementWants = cleanDraftList([
    ...(factSheetDraft.desiredRelief || []),
    caseSession.premise?.desiredRelief,
    ...(settlement.currentTerms || []),
  ]).slice(0, 4);
  const opponentSettlementWants = cleanDraftList([
    ...(factSheetDraft.disputedFacts || []),
    ...(factSheetDraft.risks || []),
    ...(caseSession.factSheet?.knownClaims || []),
  ]).slice(0, 4);
  const settlementTerms = settlement.finalTerms?.length
    ? settlement.finalTerms
    : settlement.currentTerms || [];
  const settlementAmountOption =
    settlementTerms.find((term) => /\$|payment|amount|balance/i.test(term)) ||
    firstDraftItem(factSheetDraft.desiredRelief) ||
    "Open amount";
  const settlementTimingOption =
    settlementTerms.find((term) => /day|week|month|deadline|within|timeline/i.test(term)) ||
    "Prompt performance";
  const shortenSettlementTerm = (value, fallback = "To be negotiated") => {
    const cleanValue = String(value || fallback).replace(/\s+/g, " ").trim();

    if (!cleanValue) return fallback;
    if (/\$15,?000/i.test(cleanValue)) return "$15,000";
    if (/within 10 business days/i.test(cleanValue)) return "Within 10 business days";
    if (/punch-list|750 credit/i.test(cleanValue)) return "Final punch-list visit or $750 credit";
    if (/waive|interest|costs|fee claims/i.test(cleanValue)) return "Waives interest, costs, and fee claims";
    if (/each side bears|own costs/i.test(cleanValue)) return "Each side bears own costs";
    if (/no admission/i.test(cleanValue)) return "No admission of fault";

    return cleanValue.length > 54 ? `${cleanValue.slice(0, 51)}...` : cleanValue;
  };
  const compactSettlementBreakdownValue = (label, value) => {
    const cleanValue = String(value || "").replace(/\s+/g, " ").trim();

    if (!cleanValue) return "";

    if (label === "Settlement Amount") {
      const amount = cleanValue.match(/\$\s?[\d,]+(?:\.\d{2})?/);
      return amount ? amount[0].replace(/\$\s+/, "$") : shortenSettlementTerm(cleanValue);
    }

    if (label === "Payment Timeline") {
      const duration = cleanValue.match(/\b(?:within\s+)?(\d+\s*(?:business\s+)?(?:day|days|week|weeks|month|months))\b/i);
      if (duration) return duration[1].replace(/\s+/g, " ");
      if (/prompt|immediate|as soon/i.test(cleanValue)) return "Prompt";
      return shortenSettlementTerm(cleanValue);
    }

    if (label === "Corrective Work") {
      if (/\b(no|none|without)\b.*\b(corrective|repair|work|performance)\b|no corrective work/i.test(cleanValue)) {
        return "None";
      }
      return shortenSettlementTerm(cleanValue, "Limited corrective work");
    }

    if (label === "Release Terms") {
      if (/mutual release/i.test(cleanValue)) return "Mutual release";
      if (/no release/i.test(cleanValue)) return "No release";
      return shortenSettlementTerm(cleanValue);
    }

    if (label === "Costs") {
      if (/each side.*own costs|own costs|bear.*own costs/i.test(cleanValue)) return "Each side bears own costs";
      if (/waive|waives/i.test(cleanValue)) return "Waived";
      return shortenSettlementTerm(cleanValue);
    }

    if (label === "Fault") {
      if (/no admission|without admission|no fault/i.test(cleanValue)) return "No admission of fault";
      return shortenSettlementTerm(cleanValue);
    }

    return shortenSettlementTerm(cleanValue);
  };
  const standardSettlementTermLabels = [
    "Settlement Amount",
    "Payment Timeline",
    "Corrective Work",
    "Release Terms",
    "Costs",
    "Fault",
  ];
  const getSettlementTermLabelForText = (value = "") => {
    const text = String(value || "");

    if (/\$|payment|pay|amount|refund|return|balance/i.test(text)) return "Settlement Amount";
    if (/day|week|month|deadline|within|timeline|date|prompt/i.test(text)) return "Payment Timeline";
    if (/punch|credit|repair|corrective|work|perform|complete/i.test(text)) return "Corrective Work";
    if (/future|relationship|release|waive|claim|dismiss/i.test(text)) return "Release Terms";
    if (/cost|fee|fees|interest/i.test(text)) return "Costs";
    if (/fault|admission|liability/i.test(text)) return "Fault";
    return "";
  };
  const toSettlementDisplayLabel = (value = "") =>
    String(value || "")
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const normalizeSettlementTermLabel = (value = "") => {
    const displayLabel = toSettlementDisplayLabel(value);
    return standardSettlementTermLabels.includes(displayLabel)
      ? displayLabel
      : getSettlementTermLabelForText(value) || displayLabel;
  };
  const coerceUiSettlementTermRows = (terms = []) => {
    const rows = [];
    const seen = new Set();

    for (const term of Array.isArray(terms) ? terms : []) {
      const rawLabel = Array.isArray(term) ? term[0] : term?.label;
      const rawValue = Array.isArray(term) ? term[1] : term?.value;
      let label = String(rawLabel || "").trim();
      let value = String(rawValue || "").trim();

      if (!label && typeof term === "string") {
        const [maybeLabel, ...valueParts] = term.split(":");
        const hasExplicitLabel = valueParts.length > 0 && maybeLabel.trim().length <= 36;
        label = hasExplicitLabel
          ? normalizeSettlementTermLabel(maybeLabel)
          : getSettlementTermLabelForText(term);
        value = hasExplicitLabel ? valueParts.join(":").trim() : String(term || "").trim();
      } else if (label) {
        label = normalizeSettlementTermLabel(label);
      }

      if (!label || !value || seen.has(label)) {
        continue;
      }

      seen.add(label);
      rows.push({ label, value });
    }

    return rows.slice(0, 8);
  };
  const settlementCaseFacts = [
    ["Theory", factSheetDraft.theory],
    ["Timeline", factSheetDraft.timeline],
    ["Supporting facts", factSheetDraft.supportingFacts],
    ["Risks", factSheetDraft.risks],
    ["Disputed facts", factSheetDraft.disputedFacts],
    ["Missing proof", factSheetDraft.missingEvidence],
    ["Requested relief", factSheetDraft.desiredRelief],
  ];
  const settlementClientMood = getSettlementMoodValueForSide(settlementOwnSide);
  const settlementOpponentMood = getSettlementMoodValueForSide(settlementOtherSide);
  const clientWalkoutActive = Boolean(
    isSettlement &&
      (settlementClientMood <= -100 ||
        (settlement.resolution === "failed" &&
          (settlement.endedByViewer === true || settlement.endedBySide === settlementOwnSide)))
  );
  useEffect(() => {
    if (!clientWalkoutActive) {
      return;
    }

    setShowClientWalkoutModal(true);
    setShowSettlementDialog(false);
    setShowSettlementComposeModal(false);
    setSettlementClientInstruction("");
    setClientWalkoutCountdown(5);
  }, [clientWalkoutActive]);
  useEffect(() => {
    if (isSettlement || !showClientWalkoutModal) {
      return;
    }

    setShowClientWalkoutModal(false);
    setClientWalkoutCountdown(0);
  }, [isSettlement, showClientWalkoutModal]);
  useEffect(() => {
    if (!showClientWalkoutModal || clientWalkoutCountdown <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setClientWalkoutCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [clientWalkoutCountdown, showClientWalkoutModal]);
  const handleClientWalkoutReturnToIntake = useCallback(() => {
    setShowClientWalkoutModal(false);
    setClientWalkoutCountdown(0);
    router.replace(apiConfig.workspaceHref || `/dashboard/cases/${getCaseRouteRef(caseSession)}`);
  }, [apiConfig.workspaceHref, caseSession, router]);
  useEffect(() => {
    if (!showClientWalkoutModal || clientWalkoutCountdown > 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      handleClientWalkoutReturnToIntake();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [clientWalkoutCountdown, handleClientWalkoutReturnToIntake, showClientWalkoutModal]);
  const describeSettlementMood = (value) => {
    if (value >= 45) return "Cooperative";
    if (value >= 10) return "Open";
    if (value > -20) return "Cautious";
    if (value > -55) return "Strained";
    return "Near impasse";
  };
  const formatSettlementEntryTime = (createdAt) => {
    if (!createdAt) return "";
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  const getSettlementAcceptance = (value) => {
    if (value >= 25) return { label: "Likely", tone: "text-emerald-200", icon: HeroIcons.CheckCircleIcon };
    if (value > -35) return { label: "Uncertain", tone: "text-amber-100", icon: HeroIcons.MinusCircleIcon };
    return { label: "No", tone: "text-red-200", icon: HeroIcons.XCircleIcon };
  };
  const clientAcceptance = getSettlementAcceptance(settlementClientMood);
  const opponentAcceptance = getSettlementAcceptance(settlementOpponentMood);
  const bothSettlementClientsLikely =
    clientAcceptance.label === "Likely" && opponentAcceptance.label === "Likely";
  const settlementStageIndex = settlementIsTerminal
    ? 4
    : settlementTranscript.length >= 6
    ? 2
    : settlementTranscript.length >= 2
    ? 1
    : 0;
  const settlementStages = [
    "Opening Offer",
    "Counteroffers",
    "Revise Draft",
    "Client Approval",
    "Finalize Settlement",
  ];
  const recommendedNextMove =
    bothSettlementClientsLikely
      ? "Both sides are close. Tighten payment timing and ask for approval on the current terms."
      : settlementOpponentMood < settlementClientMood
      ? "The opposing client is cautious. Consider lowering the amount slightly or adding certainty on timing and corrective work."
      : "Your client is the constraint. Preserve value while narrowing release, costs, and corrective-work obligations.";
  const summarizeSettlementEntry = (entry) => {
    const text = String(entry?.text || "").replace(/\s+/g, " ").trim();
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  };
  const getSettlementEntryText = (entry) =>
    String(entry?.text || "").replace(/\s+/g, " ").trim();
  const professionalizeSettlementProposalText = (value = "") => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";

    const hasConcreteTerm = /\$|\b\d+\s*(?:day|days|week|weeks|month|months)\b|payment|pay|refund|return|release|waive|costs|fault|deadline|timeline|corrective|work|scope/i.test(text);
    const isProfaneRejection =
      /\b(?:fuck|fucking|shit|bullshit|asshole|bastard)\b/i.test(text) ||
      /\b(?:fuck|go|back)\s+off\b/i.test(text) ||
      /\bshut up\b/i.test(text);
    const isPlainRejection = /^\s*(?:no|nah|nope|never|reject|rejected|declined?)\b/i.test(text);

    if (isProfaneRejection && !hasConcreteTerm) {
      return isPlainRejection
        ? "The other side rejects the proposal."
        : "The other side rejects the proposal in unprofessional terms.";
    }

    return text
      .replace(/\b(?:fuck|go|back)\s+off\b/gi, "declines the proposal")
      .replace(/\b(?:you|your client|your side)\s+(?:are|is)\s+(?:an?\s+)?(?:idiot|moron|clown|loser)\b/gi, "your side is taking an unreasonable position")
      .replace(/\b(?:idiot|idiots|moron|morons|stupid|dumb|clown|loser|pathetic|worthless|trash|garbage)\b/gi, "unreasonable")
      .replace(/\b(?:fuck|fucking|shit|bullshit|asshole|bastard)\b/gi, "")
      .replace(/\bshut up\b/gi, "please focus on the terms")
      .replace(/\s+([.,;:!?])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  };
  const formatSettlementOfferText = (entry) => {
    const text = getSettlementEntryText(entry);
    if (!text) return "";

    const cleaned = professionalizeSettlementProposalText(text)
      .replace(/^\s*(?:counteroffer|proposal|offer|terms)\s*:\s*/i, "")
      .replace(/\s*\|\s*/g, "; ")
      .replace(/\s*\u2022\s*/g, "; ")
      .trim();
    const clauses = cleaned
      .split(/\s*;\s*/)
      .map((clause) => clause.trim())
      .filter(Boolean);

    if (clauses.length <= 1) {
      return cleaned.replace(/\s+/g, " ");
    }

    return clauses
      .map((clause) => {
        const [rawLabel, ...rawValueParts] = clause.split(":");
        const hasExplicitLabel = rawValueParts.length > 0 && rawLabel.trim().length <= 36;
        if (!hasExplicitLabel) {
          return clause;
        }

        const label = normalizeSettlementTermLabel(rawLabel);
        const value = rawValueParts.join(":").trim();
        if (!label || !value) {
          return clause;
        }

        return `${label.charAt(0).toUpperCase()}${label.slice(1)} is ${value}`;
      })
      .join(". ")
      .replace(/\.\s*\./g, ".")
      .replace(/\s+/g, " ")
      .trim();
  };
  const latestOpponentOfferEntry =
    [...settlementHumanTranscript]
      .reverse()
      .find((entry) => entry?.role === "opponent" || entry?.isViewer === false) || null;
  const latestPublicNegotiationEntry =
    [...settlementHumanTranscript]
      .reverse()
      .find(
        (entry) =>
          entry?.role === "player" ||
          entry?.role === "opponent" ||
          typeof entry?.isViewer === "boolean"
      ) || null;
  const opposingCounselWasLatest = Boolean(
    latestPublicNegotiationEntry &&
      (latestPublicNegotiationEntry.role === "opponent" ||
        latestPublicNegotiationEntry.isViewer === false)
  );
  const latestOpponentOfferText = formatSettlementOfferText(latestOpponentOfferEntry);
  const settlementCurrentTermRows = coerceUiSettlementTermRows(settlementTerms);
  const getStructuredSettlementTermValue = (terms = [], label = "") =>
    coerceUiSettlementTermRows(terms).find((term) => term?.label === label)?.value || "";
  const customCurrentTermRows = settlementCurrentTermRows.filter(
    (term) => !standardSettlementTermLabels.includes(term.label)
  );
  const currentOfferTerms = [
    ...standardSettlementTermLabels.map((label) => [
      label,
      settlementCurrentTermRows.find((term) => term.label === label)?.value || "",
    ]),
    ...customCurrentTermRows.map((term) => [term.label, term.value]),
  ];
  const latestOpponentOfferTerms = coerceUiSettlementTermRows(settlement.latestOpponentTerms);
  const latestOpponentOfferTermsObject = Object.fromEntries(
    latestOpponentOfferTerms
      .filter((term) => term?.label && term?.value)
      .map((term) => [term.label, term.value])
  );
  const latestOpponentOfferSignature = latestOpponentOfferEntry
    ? JSON.stringify({
        speaker: latestOpponentOfferEntry.speaker || "",
        createdAt: latestOpponentOfferEntry.createdAt || "",
        text: getSettlementEntryText(latestOpponentOfferEntry),
        terms: latestOpponentOfferTerms
          .filter((term) => term?.label && term?.value)
          .map((term) => [term.label, term.value]),
      })
    : "";
  const serverSettlementClientPreview = settlement.clientPreview || null;
  const serverSettlementClientPreviewVersion = settlement.clientPreviewUpdatedAt || "";
  const settlementDraftDefaultEntries = currentOfferTerms.map(([label, value]) => [
    label,
    String(value || "").trim(),
  ]);
  const settlementDraftSignature = JSON.stringify(settlementDraftDefaultEntries);

  useEffect(() => {
    setSettlementAcceptAuthority((current) =>
      current.offerSignature === latestOpponentOfferSignature
        ? current
        : { offerSignature: "", authority: "unclear", reason: "" }
    );
  }, [latestOpponentOfferSignature]);

  useEffect(() => {
    if (!serverSettlementClientPreview || !latestOpponentOfferSignature) {
      return;
    }

    setSettlementClientPreview(serverSettlementClientPreview);
    setSettlementClientPreviewError("");
    setSettlementAcceptAuthority(
      serverSettlementClientPreview.acceptanceAuthority === "accept"
        ? {
            offerSignature: latestOpponentOfferSignature,
            authority: "accept",
            reason:
              serverSettlementClientPreview.authorityReason ||
              "Client says the latest offer is within settlement authority.",
          }
        : { offerSignature: "", authority: "unclear", reason: "" }
    );
  }, [
    latestOpponentOfferSignature,
    serverSettlementClientPreview,
    serverSettlementClientPreviewVersion,
  ]);

  useEffect(() => {
    setSettlementDraftState((current) => {
      if (current.sourceSignature === settlementDraftSignature) {
        return current;
      }

      return {
        sourceSignature: settlementDraftSignature,
        values: Object.fromEntries(JSON.parse(settlementDraftSignature)),
        dirty: false,
      };
    });
  }, [settlementDraftSignature]);

  const settlementDraftValues =
    settlementDraftState.sourceSignature === settlementDraftSignature
      ? settlementDraftState.values
      : Object.fromEntries(settlementDraftDefaultEntries);
  const editableSettlementTerms = settlementDraftDefaultEntries.map(([label, fallbackValue]) => [
    label,
    settlementDraftValues?.[label] ?? fallbackValue,
  ]);
  const filledEditableSettlementTerms = editableSettlementTerms.filter(([, value]) =>
    String(value || "").trim()
  );
  const settlementDraftMessage = filledEditableSettlementTerms.length
    ? `Counteroffer: ${filledEditableSettlementTerms
        .map(([label, value]) => `${label}: ${String(value || "").trim()}`)
        .join("; ")}.`
    : "Counteroffer: Please clarify which settlement terms are still open.";
  const composerClientPreview =
    opposingCounselWasLatest && serverSettlementClientPreview
      ? serverSettlementClientPreview
      : settlementClientPreview;
  const settlementClientGuidanceParts = cleanDraftList([
    composerClientPreview?.authorityReason,
    composerClientPreview?.suggestedRevision,
    ...(Array.isArray(composerClientPreview?.drivers)
      ? composerClientPreview.drivers
      : []),
  ]).slice(0, 4);
  const settlementClientGuidedMessage = settlementClientGuidanceParts.length
    ? `Counteroffer: My client can continue settlement discussions within this range: ${settlementClientGuidanceParts.join("; ")}. Please respond with concrete terms that fit those conditions.`
    : settlementDraftMessage;
  const latestOpponentProposalSummary = latestOpponentOfferTerms
    .filter((term) => term?.label && term?.value)
    .slice(0, 4)
    .map((term) => `${term.label}: ${term.value}`)
    .join("; ");
  const latestOpponentResponseExcerpt = String(latestOpponentOfferText || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  const responseAwareSettlementMessage = opposingCounselWasLatest
    ? [
        latestOpponentProposalSummary
          ? `We have reviewed your latest proposal (${latestOpponentProposalSummary}).`
          : latestOpponentResponseExcerpt
          ? `We have reviewed your latest response: "${latestOpponentResponseExcerpt}${
              latestOpponentOfferText.length > 180 ? "..." : ""
            }".`
          : "We have reviewed your latest response.",
        settlementClientGuidedMessage,
      ].join(" ")
    : settlementClientGuidedMessage;
  const getSettlementComposerDefaultMessage = (current = "") => {
    const cleanCurrent = String(current || "").trim();
    const genericFallback = "Counteroffer: Please clarify which settlement terms are still open.";

    return !cleanCurrent || cleanCurrent === genericFallback
      ? responseAwareSettlementMessage
      : cleanCurrent;
  };
  const settlementPreviewApiPath = `${getApiBasePath(caseSession)}/settlement/preview`;

  const handleSettlementClientInstructionSubmit = async (event) => {
    event?.preventDefault();

    if (
      clientWalkoutActive ||
      settlementClientInstructionWorking ||
      transcribingSettlementClientInstruction ||
      working ||
      !settlementClientInstruction.trim()
    ) {
      return;
    }

    setSettlementClientInstructionWorking(true);
    setSettlementClientPreviewError("");

    try {
      const response = await fetch(`/api${settlementPreviewApiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms: Object.fromEntries(editableSettlementTerms),
          message: settlementDraftMessage,
          clientInstruction: settlementClientInstruction.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Could not talk to the client.");
      }

      const preview = payload?.preview || null;
      if (payload?.caseSession) {
        updateCaseFromResponse(payload);
      }
      setSettlementClientPreview(preview);

      setSettlementClientInstruction("");
    } catch (error) {
      setSettlementClientPreviewError(error?.message || "Could not talk to the client.");
    } finally {
      setSettlementClientInstructionWorking(false);
    }
  };

  const previewTone = ["emerald", "amber", "red"].includes(
    String(settlementClientPreview?.tone || "").toLowerCase()
  )
    ? String(settlementClientPreview?.tone || "").toLowerCase()
    : "amber";
  const draftClientReaction =
    settlementClientInstructionWorking
      ? {
          label: `${playerPartyName} is considering...`,
          tone: "amber",
          icon: HeroIcons.ArrowPathIcon,
          note: "They are weighing what they want from the case.",
        }
      : settlementClientPreviewError
      ? {
          label: `${playerPartyName} is still thinking`,
          tone: "amber",
          icon: HeroIcons.ExclamationTriangleIcon,
          note: "The huddle is not ready yet. You can still present a clear, concrete proposal.",
        }
      : settlementClientPreview
      ? {
          label: settlementClientPreview.label || "Client reaction ready",
          tone: previewTone,
          icon:
            previewTone === "emerald"
              ? HeroIcons.CheckCircleIcon
              : previewTone === "red"
              ? HeroIcons.ExclamationTriangleIcon
              : HeroIcons.MinusCircleIcon,
          note:
            settlementClientPreview.note ||
            `${playerPartyName} has a private reaction to these terms.`,
        }
      : {
          label: "Ask client privately",
          tone: "amber",
          icon: HeroIcons.MinusCircleIcon,
          note: `Ask ${playerPartyName} about the latest offer before speaking for them.`,
        };
  const draftClientReactionDrivers =
    settlementClientInstructionWorking
      ? [`${playerPartyName} is weighing value, timing, release, costs, and fault.`]
      : settlementClientPreviewError
      ? ["The client reaction is delayed. Keep the proposal concrete."]
      : Array.isArray(settlementClientPreview?.drivers) && settlementClientPreview.drivers.length
      ? settlementClientPreview.drivers.slice(0, 3)
      : [`${playerPartyName}'s private guidance will appear after you ask.`];
  const clientHuddleUpdatedAt = new Date(
    settlement.clientHuddle?.updatedAt || 0
  ).getTime();
  const clientPreviewUpdatedAt = new Date(
    settlement.clientPreviewUpdatedAt || 0
  ).getTime();
  const clientHuddleMoodFeedback =
    clientHuddleUpdatedAt >= clientPreviewUpdatedAt && settlement.clientHuddle?.lastReason
      ? `${Number(settlement.clientHuddle.lastDelta) > 0 ? "Mood +" : "Mood "}${
          Number(settlement.clientHuddle.lastDelta) || 0
        }: ${settlement.clientHuddle.lastReason}`
      : "";
  const visibleClientReactionDrivers = cleanDraftList([
    clientHuddleMoodFeedback,
    ...draftClientReactionDrivers,
  ]).slice(0, 3);
  const renderSettlementIntentNoticePanel = (className = "") =>
    isPendingSettlementIntent || settlementAuthorityReady ? (
      <div
        className={`overflow-hidden rounded-2xl border border-emerald-200/30 bg-emerald-300/[0.09] shadow-[0_18px_60px_rgba(16,185,129,0.1)] ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex gap-3 p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100/25 bg-black/22 text-emerald-100">
            <HeroIcons.ClockIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-emerald-100">
              {awaitingSettlementResponse
                ? "Settlement Intent Sent"
                : pendingSettlementIntentFromOther
                ? "Settlement Intent Received"
                : "Settlement Authority Ready"}
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-white sm:text-2xl">
              {awaitingSettlementResponse
                ? "Settlement intent sent, awaiting response"
                : settlementAuthorityReady
                ? "Send settlement intent"
                : "Settlement intent received"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/68">
              {awaitingSettlementResponse
                ? "Opposing counsel needs to ask their client and respond before you can continue intake, finalize the fact sheet, or send another settlement message."
                : settlementAuthorityReady
                ? "Your client has given settlement authority. Intake is paused so you can send the other player a settlement intent."
                : "Ask your client whether they consent to settlement. Yes unlocks Accept; No unlocks Reject."}
            </p>
            {pendingSettlementIntentFromOther ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <span
                  data-tooltip-id={!hasSettlementAuthority ? "settlement-authority-tooltip" : undefined}
                  data-tooltip-content={
                    !hasSettlementAuthority
                      ? "Ask your client to consent to settlement before accepting. Try explaining the offer, court risk, and likely outcome."
                      : undefined
                  }
                  className="block"
                >
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-100/50 bg-emerald-100 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={handleAcceptSettlementIntent}
                    disabled={working || !hasSettlementAuthority}
                  >
                    {pendingAction === "settlement-start" ? "Accepting..." : "Yes, Accept"}
                    <HeroIcons.CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
                <span
                  data-tooltip-id={!hasSettlementRejection ? "settlement-authority-tooltip" : undefined}
                  data-tooltip-content={
                    !hasSettlementRejection
                      ? "Reject unlocks only after your client clearly says no to settlement."
                      : undefined
                  }
                  className="block"
                >
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/45 bg-rose-400/[0.12] px-4 py-2.5 text-sm font-bold text-rose-50 transition hover:border-rose-100/70 hover:bg-rose-400/[0.18] disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={handleRejectSettlementIntent}
                    disabled={working || !hasSettlementRejection}
                  >
                    {pendingAction === "settlement-reject" ? "Rejecting..." : "No, Reject"}
                    <HeroIcons.XCircleIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              </div>
            ) : settlementAuthorityReady ? (
              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-100/50 bg-emerald-100 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSendSettlementIntent}
                disabled={
                  working ||
                  pendingAction === "settlement-start" ||
                  !hasSettlementAuthority ||
                  awaitingSettlementResponse
                }
              >
                {pendingAction === "settlement-start" ? "Sending Intent..." : "Send Settlement Intent"}
                <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    ) : null;

  const renderSettlementWalkoutNoticePanel = (className = "") =>
    settlementEndedByOther ? (
      <div
        className={`rounded-2xl bg-amber-200/[0.055] p-4 text-sm font-semibold leading-6 text-amber-50 shadow-[0_16px_50px_rgba(0,0,0,0.18)] ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex gap-3">
          <HeroIcons.ArrowUturnLeftIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-200/80" aria-hidden="true" />
          <div className="min-w-0">
            <p className="arena-kicker text-amber-200">Settlement talks ended</p>
            <p className="mt-1 text-white/70">
              Opponent walked out of settlement negotiations. Intake is open again.
            </p>
          </div>
        </div>
      </div>
    ) : null;

  const renderSettleButton = (className = "arena-btn-dark w-full px-5 py-3") => {
    if (!canSettleCase) {
      return null;
    }

    const disabled =
      working ||
      isIntakeLocked ||
      awaitingSettlementResponse ||
      isSettlementCooldownActive ||
      pendingSettlementIntentFromViewer ||
      !hasSettlementAuthority;
    const tooltip = !hasSettlementAuthority
      ? "Ask your client if they are willing to settle this out of court. This unlocks once they agree."
      : pendingSettlementIntentFromViewer
      ? "Settlement intent has been sent. Opposing counsel needs to ask their client before talks open."
      : settlementAuthorityReady
      ? "Send a settlement intent to opposing counsel before continuing intake."
      : "";

    return (
      <span
        className="block w-full"
        data-tooltip-id={tooltip ? "settlement-authority-tooltip" : undefined}
        data-tooltip-content={tooltip || undefined}
      >
        <button
          type="button"
          className={className}
          onClick={() => {
            if (disabled) {
              return;
            }

            if (settlementAuthorityReady) {
              handleSendSettlementIntent();
              return;
            }

            handleOpenSettlementDialog();
          }}
          disabled={disabled}
        >
          {pendingAction === "settlement-start"
            ? pendingSettlementIntentFromOther
              ? "Sending Response..."
              : "Sending Intent..."
            : pendingAction === "settlement-draft"
            ? "Drafting Offer..."
            : pendingSettlementIntentFromViewer
            ? "Settlement Intent Sent"
            : pendingSettlementIntentFromOther
            ? "Respond to Settlement"
            : settlementAuthorityReady
            ? "Send Settlement Intent"
            : isSettlementCooldownActive
            ? `Settle in ${settlementCooldownLabel}`
            : "Settle"}
        </button>
      </span>
    );
  };

  const handleFactSheetPrimaryAction = () => {
    if (settlementAuthorityReady) {
      handleSendSettlementIntent();
      return;
    }

    handleFinalize();
  };

  const factSheetPrimaryActionDisabled = settlementAuthorityReady
    ? working || isIntakeLocked || awaitingSettlementResponse
    : working || intakeActionsLocked;

  const renderSettlementPanel = () => {
    const settlementStageLabel = settlementStages[settlementStageIndex] || settlementStages[0];
    const clientPrivateLine = String(settlementClientPreview?.privateClientLine || "").trim();
    const clientWantsCounter = settlementClientPreview?.acceptanceAuthority === "counter";
    const blockerText =
      clientWantsCounter
        ? "Client wants a counter"
      : settlementOpponentMood < settlementClientMood
        ? settlementOpponentMood < -25
          ? "Opposing client still resisting"
          : "Amount too high"
        : settlementClientMood < -25
        ? "Client needs more certainty"
        : "Next reply needed";
    const clientAcceptanceReason =
      settlementClientMood < 0
        ? "Open to resolution, wants fair amount and certainty."
        : "Constructive if payment and release terms stay practical.";
    const clientSpokenLine = clientPrivateLine
      ? clientPrivateLine
      : settlementClientInstructionWorking
      ? "I am thinking through the amount, timing, and release."
      : settlementClientPreviewError
      ? "I need the offer spelled out more clearly before I can react."
      : clientWantsCounter
      ? "That is not inside my acceptable range. Counter with the conditions I gave you."
      : "I can work with this if the terms protect what matters most.";
    const opponentAcceptanceReason =
      settlementOpponentMood < 0
        ? "Open to compromise, but amount feels high."
        : "Willing to evaluate concrete terms.";
    const actionableNextMove =
      settlementClientMood < settlementOpponentMood
        ? "Your client is the constraint. Do not lower the amount yet. Offer a narrower release or clearer corrective-work limit."
        : settlementOpponentMood < -20
        ? "The opposing client is the constraint. Consider a cleaner payment timeline or a limited corrective-work option before lowering the amount."
        : recommendedNextMove;
    const statusCards = [
      {
        title: "Your Client Mood",
        value: `${getSettlementMoodEmoji(settlementClientMood)} ${describeSettlementMood(settlementClientMood)} - ${formatSettlementMoodScore(settlementClientMood)}`,
        emoji: getSettlementMoodEmoji(settlementClientMood),
        icon: HeroIcons.UserGroupIcon,
        tone: "emerald",
      },
      {
        title: "Opposing Client Mood",
        value: `${getSettlementMoodEmoji(settlementOpponentMood)} ${describeSettlementMood(settlementOpponentMood)} - ${formatSettlementMoodScore(settlementOpponentMood)}`,
        emoji: getSettlementMoodEmoji(settlementOpponentMood),
        icon: HeroIcons.UserGroupIcon,
        tone: "red",
      },
      {
        title: "Main Blocker",
        value: blockerText,
        icon: HeroIcons.ExclamationTriangleIcon,
        tone: "amber",
      },
      {
        title: "Stage",
        value: settlementStageLabel,
        icon: HeroIcons.FlagIcon,
        tone: "amber",
      },
    ];
    const offerTiles = [
      {
        label: "Settlement Amount",
        value: shortenSettlementTerm(getStructuredSettlementTermValue(settlementCurrentTermRows, "Settlement Amount"), "Not stated"),
        icon: HeroIcons.CurrencyDollarIcon,
      },
      {
        label: "Payment Timeline",
        value: shortenSettlementTerm(getStructuredSettlementTermValue(settlementCurrentTermRows, "Payment Timeline"), "Not stated"),
        icon: HeroIcons.CalendarDaysIcon,
      },
      {
        label: "Corrective Work",
        value: shortenSettlementTerm(getStructuredSettlementTermValue(settlementCurrentTermRows, "Corrective Work"), "Not stated"),
        icon: HeroIcons.WrenchScrewdriverIcon,
      },
      {
        label: "Release",
        value: shortenSettlementTerm(getStructuredSettlementTermValue(settlementCurrentTermRows, "Release Terms"), "Not stated"),
        icon: HeroIcons.DocumentTextIcon,
      },
      {
        label: "Costs",
        value: shortenSettlementTerm(getStructuredSettlementTermValue(settlementCurrentTermRows, "Costs"), "Not stated"),
        icon: HeroIcons.ScaleIcon,
      },
      {
        label: "Fault",
        value: shortenSettlementTerm(getStructuredSettlementTermValue(settlementCurrentTermRows, "Fault"), "Not stated"),
        icon: HeroIcons.ShieldCheckIcon,
      },
    ];
    const recentSettlementEntries = settlementHumanTranscript.slice(-3).reverse();
    const supportItems = [
      {
        label: "Client priorities",
        key: "client",
        icon: HeroIcons.UserIcon,
        detail: (playerSettlementWants[0] || "Review what your client needs most."),
      },
      {
        label: "Opposing client priorities",
        key: "opponent",
        icon: HeroIcons.UserIcon,
        detail: (opponentSettlementWants[0] || "Review what the other side is resisting."),
      },
      {
        label: "Compare with court",
        key: "court",
        icon: HeroIcons.ScaleIcon,
        detail: "Weigh settlement certainty against courtroom risk.",
      },
      {
        label: "Case facts",
        key: "facts",
        icon: HeroIcons.DocumentTextIcon,
        detail: "Theory, risks, proof, and relief.",
      },
      {
        label: "Full negotiation history",
        key: "history",
        icon: HeroIcons.ArrowPathIcon,
        detail: `${settlementTranscript.length} exchange${settlementTranscript.length === 1 ? "" : "s"}`,
      },
    ];
    const activeSupportItem = supportItems.find((item) => item.key === activeSettlementInfo) || supportItems[0];
    const activeSettlementInfoKey = activeSupportItem?.key || "client";
    const openSettlementInfo = (key) => {
      setActiveSettlementInfo(key);
      setIsSettlementInfoModalOpen(true);
    };
    const closeSettlementInfo = () => {
      setIsSettlementInfoModalOpen(false);
    };
    const settlementInfoRows = {
      client: [
        ["Client goals", playerSettlementWants],
        ["Concerns", cleanDraftList(factSheetDraft.risks).slice(0, 3)],
        ["Hard lines", ["No admission of fault", "No open-ended extra work"]],
        ["Improves acceptance", ["Certainty on timing", "Clear release scope", "Practical payment recovery"]],
        ["Hurts acceptance", ["Too little payment", "Broad blame", "Open-ended corrective work"]],
      ],
      opponent: [
        ["Opposing client goals", opponentSettlementWants],
        ["Concerns", cleanDraftList(factSheetDraft.disputedFacts).slice(0, 3)],
        ["Hard lines", ["Lower payment amount", "Quality concerns acknowledged"]],
        ["Improves acceptance", ["Specific amount reduction", "Finite corrective work", "No fee escalation"]],
        ["Hurts acceptance", ["Full invoice demand", "No delay acknowledgment", "Unclear release terms"]],
      ],
      court: [
        ["Settle now", [`Recovery: ${shortenSettlementTerm(settlementAmountOption)}`, `Time: ${shortenSettlementTerm(settlementTimingOption)}`, "Risk: Lower"]],
        ["Go to court", ["Expected recovery: Potential full recovery", "Time: Months", "Risk: Medium / High"]],
        ["Key weakness", cleanDraftList(factSheetDraft.risks).slice(0, 2)],
      ],
      facts: settlementCaseFacts,
      history: [["Chronological messages", settlementTranscript.map((entry) => `${entry.role === "player" ? "You" : entry.speaker}: ${entry.text}`)]],
    };
    const toneClasses = {
      emerald: {
        card: "border-emerald-300/10 bg-emerald-300/[0.045]",
        icon: "border-emerald-300/12 bg-emerald-300/10 text-emerald-200",
        text: "text-emerald-200",
      },
      red: {
        card: "border-red-300/10 bg-red-300/[0.045]",
        icon: "border-red-300/12 bg-red-300/10 text-red-200",
        text: "text-red-200",
      },
      amber: {
        card: "border-amber-200/10 bg-amber-200/[0.04]",
        icon: "border-amber-200/12 bg-amber-200/10 text-amber-200",
        text: "text-amber-200",
      },
    };
    const clientReactionTone = toneClasses[draftClientReaction.tone] || toneClasses.amber;
    const ClientReactionIcon = draftClientReaction.icon;
    const getSettlementTermIcon = (label) =>
      label === "Settlement Amount"
        ? HeroIcons.CurrencyDollarIcon
        : label === "Payment Timeline"
        ? HeroIcons.CalendarDaysIcon
        : label === "Corrective Work"
        ? HeroIcons.WrenchScrewdriverIcon
        : label === "Release Terms"
        ? HeroIcons.DocumentTextIcon
        : label === "Costs"
        ? HeroIcons.ScaleIcon
        : HeroIcons.ShieldCheckIcon;
    const sidePanelTermRows = latestOpponentOfferTerms.map(({ label, value }) => ({
      label,
      value: compactSettlementBreakdownValue(label, value),
      icon: getSettlementTermIcon(label),
    })).filter((term) => term.label && term.value);
    const hasConcreteLatestOpponentTerms = latestOpponentOfferTerms.some(
      (term) => term?.label && term?.value
    );
    const clientAuthorizedLatestOffer =
      hasConcreteLatestOpponentTerms &&
      latestOpponentOfferSignature &&
      settlementAcceptAuthority.offerSignature === latestOpponentOfferSignature &&
      settlementAcceptAuthority.authority === "accept";
    const publicTermSummary = sidePanelTermRows
      .map((term) => `${term.label}: ${term.value}`)
      .join("; ");
    const settlementAcceptMessage = publicTermSummary
      ? `My client accepts the current settlement terms: ${publicTermSummary}. Please confirm we have agreement.`
      : "My client accepts your latest settlement proposal. Please confirm we have agreement.";
    const handleAskClientAboutLatestOffer = async () => {
      if (settlementActionsLocked || settlementClientInstructionWorking) {
        return;
      }

      setSettlementClientInstructionWorking(true);
      setSettlementClientPreviewError("");

      try {
        const concreteInstruction =
          "Can you live with this latest offer, and what range or conditions would still be acceptable? If this offer is within your authority, say I can accept it. If not, tell me what to counter with.";
        const clarificationInstruction =
          "The other side has not stated concrete settlement terms. What range of concrete terms would be acceptable before I reply?";
        const response = await fetch(`/api${settlementPreviewApiPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terms: hasConcreteLatestOpponentTerms
              ? latestOpponentOfferTermsObject
              : Object.fromEntries(editableSettlementTerms),
            message: hasConcreteLatestOpponentTerms
              ? latestOpponentOfferText || settlementDraftMessage
              : settlementDraftMessage,
            clientInstruction: hasConcreteLatestOpponentTerms
              ? concreteInstruction
              : clarificationInstruction,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || "Could not talk to the client.");
        }

        const preview = payload?.preview || null;
        if (payload?.caseSession) {
          updateCaseFromResponse(payload);
        }
        setSettlementClientPreview(preview);

        if (
          hasConcreteLatestOpponentTerms &&
          latestOpponentOfferSignature &&
          preview?.acceptanceAuthority === "accept"
        ) {
          setSettlementAcceptAuthority({
            offerSignature: latestOpponentOfferSignature,
            authority: "accept",
            reason: preview?.authorityReason || "Client says this offer is within settlement authority.",
          });
        } else {
          setSettlementAcceptAuthority({ offerSignature: "", authority: "unclear", reason: "" });
        }

      } catch (error) {
        setSettlementClientPreviewError(error?.message || "Could not talk to the client.");
      } finally {
        setSettlementClientInstructionWorking(false);
      }
    };
    const handleAcceptSettlementTerms = () => {
      if (!clientAuthorizedLatestOffer) {
        return;
      }

      submitSettlementMessage({
        messageOverride: settlementAcceptMessage,
        acceptTerms: true,
        termsOverride: latestOpponentOfferTermsObject,
      });
    };
    const settlementPressureMessage = [
      "We have stayed at the table and made concrete terms available.",
      "If your side cannot move meaningfully now, we are prepared to end settlement discussions and proceed on the record we have.",
      "Please respond with a specific improvement to amount, timing, or release language rather than another general objection.",
    ].join(" ");
    const settlementClarificationMessage = [
      "Before we revise further, please identify the specific term your side cannot accept.",
      "Is the issue the amount, payment deadline, corrective-work scope, release language, costs, or fault language?",
    ].join(" ");
    const settlementClientWarningText = `${playerPartyName}, I need to be direct: if the other side keeps repeating positions without improving the terms, settlement may be wasting time. We can apply pressure once more, or walk away and return to building the case.`;
    const settlementNextMoveActions = [
      clientAuthorizedLatestOffer
        ? {
        title: "Accept terms",
            body: "Accept the latest offer because it is within your client's authority.",
        icon: HeroIcons.CheckCircleIcon,
        tone: "emerald",
        onClick: handleAcceptSettlementTerms,
          }
        : {
            title: "Ask client first",
            body: hasConcreteLatestOpponentTerms
              ? "Ask whether the latest offer is within your client's acceptable range."
              : "Ask what range of concrete terms your client needs before you reply.",
            icon: HeroIcons.UserIcon,
            tone: "emerald",
            onClick: handleAskClientAboutLatestOffer,
          },
      {
        title: "Make counteroffer",
        body: "Use what your client told you privately, then present a new offer.",
        icon: HeroIcons.PencilSquareIcon,
        tone: "amber",
        featured: true,
        onClick: () => setSettlementMessageAndFocus(getSettlementComposerDefaultMessage),
      },
      {
        title: "Apply pressure",
        body: "Warn the other side that talks may end unless they move concretely.",
        icon: HeroIcons.ExclamationTriangleIcon,
        tone: "red",
        onClick: () => setSettlementMessageAndFocus(settlementPressureMessage),
      },
      {
        title: "Ask a question",
        body: "Force clarity on which term is blocking agreement.",
        icon: HeroIcons.QuestionMarkCircleIcon,
        tone: "amber",
        onClick: () => setSettlementMessageAndFocus(settlementClarificationMessage),
      },
      {
        title: "Warn client",
        body: "Privately tell your client settlement may be wasting time.",
        icon: HeroIcons.UserIcon,
        tone: "amber",
        onClick: () => setSettlementClientCounselNote(settlementClientWarningText),
      },
      {
        title: "Walk away",
        body: "End settlement talks and return to intake.",
        icon: HeroIcons.ArrowUturnLeftIcon,
        tone: "red",
        onClick: () => {
          setSettlementClientCounselNote(settlementClientWarningText);
          handleSettlementExit();
        },
      },
    ];
    const settlementActionsLocked =
      clientWalkoutActive ||
      working ||
      awaitingNegotiationResponse ||
      (analyticsMode === "pvp" &&
        isSettlement &&
        Boolean(negotiationTurnUserId) &&
        !receivedNegotiationMessage);
    const settlementMessageInTransit = pendingAction === "settlement";
    const settlementComposeModal =
      portalReady && showSettlementComposeModal
        ? createPortal(
            <div
              className="modal modal-middle modal-open"
              role="dialog"
              aria-modal="true"
              aria-label="Message opposing counsel"
            >
              <div className="modal-box max-h-[86vh] overflow-hidden rounded-2xl border border-amber-200/10 bg-[#070908] p-0 text-white shadow-2xl shadow-black/70 sm:w-[min(48rem,calc(100vw-3rem))] sm:max-w-none">
                <div className="border-b border-white/[0.06] p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="arena-kicker text-amber-200">Message to opposing counsel</p>
                      <h3 className="mt-2 text-xl font-black leading-tight text-white">
                        {settlementMessageInTransit
                          ? "Counteroffer in motion"
                          : "Send negotiation message"}
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-white/48">
                        {settlementMessageInTransit
                          ? "Delivering your terms and waiting for opposing counsel."
                          : "Write the exact response you want the other side to receive."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-circle btn-ghost btn-sm shrink-0 border border-white/[0.06] text-white/65 hover:border-amber-200/25 hover:bg-white/[0.04] hover:text-white"
                      onClick={() => setShowSettlementComposeModal(false)}
                      disabled={settlementMessageInTransit}
                      aria-label="Close message composer"
                    >
                      <HeroIcons.XMarkIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <form
                  ref={settlementMessageComposerRef}
                  className="space-y-4 p-4 sm:p-5"
                  onSubmit={handleSettlementMessageSubmit}
                  data-settlement-tour-target="settlement-message"
                >
                  {settlementMessageInTransit ? (
                    <div
                      className="arena-settlement-dispatch relative flex min-h-[17rem] overflow-hidden rounded-xl border border-amber-200/[0.09] bg-[radial-gradient(circle_at_center,rgba(253,224,71,0.09),rgba(0,0,0,0.18)_58%,rgba(0,0,0,0.38))] px-6 py-8"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
                        <span className="arena-settlement-dispatch-orbit absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/10" />
                        <span className="arena-settlement-dispatch-orbit arena-settlement-dispatch-orbit-reverse absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-amber-100/[0.08]" />
                      </div>
                      <div className="relative z-10 m-auto flex max-w-md flex-col items-center text-center">
                        <div className="relative grid h-24 w-24 place-items-center rounded-full border border-amber-200/20 bg-amber-200/[0.08] shadow-[0_0_55px_rgba(253,224,71,0.12)]">
                          <span className="arena-settlement-dispatch-trail absolute left-1 top-1/2 h-px w-9 bg-gradient-to-r from-transparent to-amber-200/70" aria-hidden="true" />
                          <HeroIcons.PaperAirplaneIcon
                            className="arena-settlement-dispatch-plane h-11 w-11 text-amber-100"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="mt-6 text-lg font-black text-white">Opposing counsel is reviewing</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-white/52">
                          Your counteroffer has left the huddle. The other side is weighing the amount, timing, and release terms.
                        </p>
                        <div className="mt-5 flex items-center gap-2" aria-hidden="true">
                          {[0, 1, 2].map((dot) => (
                            <span
                              key={dot}
                              className="arena-settlement-dispatch-dot h-2 w-2 rounded-full bg-amber-200"
                              style={{ animationDelay: `${dot * 180}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                  <div className="overflow-hidden rounded-xl border border-white/[0.04] bg-black/26">
                    <textarea
                      ref={settlementMessageTextareaRef}
                      value={settlementMessage}
                      onChange={(event) => setSettlementMessage(event.target.value)}
                      rows={6}
                      className="block min-h-40 w-full resize-none border-0 bg-transparent px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/34"
                      placeholder="Write your negotiation message..."
                      disabled={settlementActionsLocked || transcribingSettlementMessage}
                    />
                    <div className="flex items-center justify-between gap-3 border-t border-white/[0.035] px-4 py-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.08]">
                        <span
                          className="block h-full rounded-full bg-amber-200 transition-[width]"
                          style={{
                            width: recordingSettlementMessage
                              ? `${Math.max(8, Math.round(settlementMessageAudioLevel * 100))}%`
                              : "0%",
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-white/38">
                        {transcribingSettlementMessage
                          ? "Transcribing..."
                          : recordingSettlementMessage
                          ? "Listening..."
                          : `${settlementMessage.trim().length} / 2500`}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="arena-btn-dark inline-flex min-h-0 items-center justify-center gap-2 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-55"
                        onClick={() => setSettlementMessage("")}
                        disabled={
                          settlementActionsLocked ||
                          recordingSettlementMessage ||
                          transcribingSettlementMessage ||
                          !settlementMessage
                        }
                      >
                        Clear
                        <HeroIcons.XMarkIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`arena-btn-dark inline-flex min-h-0 items-center justify-center gap-2 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-55 ${
                          recordingSettlementMessage ? "border-red-300/40 text-red-100" : ""
                        }`}
                        onClick={handleSettlementMessageVoiceInput}
                        disabled={settlementActionsLocked || transcribingSettlementMessage}
                        aria-label={
                          recordingSettlementMessage
                            ? "Stop message voice note"
                            : "Record message voice note"
                        }
                      >
                        {recordingSettlementMessage
                          ? "Stop"
                          : transcribingSettlementMessage
                          ? "Transcribing"
                          : "Voice"}
                        <HeroIcons.MicrophoneIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="arena-btn-light inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
                      onPointerDown={triggerSettlementHaptic}
                      onClick={() =>
                        submitSettlementMessage({
                          messageOverride: settlementMessage.trim(),
                        })
                      }
                      disabled={
                        settlementActionsLocked ||
                        recordingSettlementMessage ||
                        transcribingSettlementMessage ||
                        !settlementMessage.trim()
                      }
                    >
                      {pendingAction === "settlement" ? "Sending..." : "Send Counteroffer"}
                      <HeroIcons.PaperAirplaneIcon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                    </>
                  )}
                </form>
              </div>
              <button
                type="button"
                className="modal-backdrop"
                onClick={() => {
                  if (!settlementMessageInTransit) {
                    setShowSettlementComposeModal(false);
                  }
                }}
                disabled={settlementMessageInTransit}
                aria-label="Close message composer"
              >
                close
              </button>
            </div>,
            document.body
          )
        : null;
    const finalAgreementTerms = sidePanelTermRows.filter((term) => term.value);
    const finalAgreementSummary =
      settlement.outcomeSummary ||
      "Both sides accepted the settlement terms. The matter is resolved without going to court.";
    const completedAtLabel = settlement.completedAt
      ? new Date(settlement.completedAt).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Recorded";
    const settlementXp = calculateSettlementXp({
      complexity: caseSession.complexity,
      finalMoods: settlement.moods,
    });
    const settlementQuality = settlementXp.quality;
    const hasReachedSettlement = isSettled || settlement.status === "settled";

    if (hasReachedSettlement) {
      return (
        <div id="settlement" className="mx-auto w-full max-w-[1600px] space-y-4">
          <section className="arena-surface overflow-hidden border-emerald-200/18 bg-emerald-300/[0.035]">
            <div className="mx-auto w-full max-w-5xl p-5 sm:p-7 lg:p-9">
              <div className="flex min-w-0 gap-4">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-emerald-200/35 bg-emerald-300/12 text-emerald-100 shadow-[0_0_40px_rgba(110,231,183,0.12)]">
                  <HeroIcons.CheckCircleIcon className="h-9 w-9" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="arena-kicker text-emerald-200">Settlement Complete</p>
                  <h2 className="mt-2 text-3xl font-black leading-tight text-white sm:text-4xl">
                    Agreement reached
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/64">
                    Negotiation is over. These are the final terms recorded for this matter.
                  </p>
                </div>
              </div>

              <div className="mt-7 overflow-hidden rounded-2xl border border-emerald-200/18 bg-black/22">
                <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-stretch">
                  <div className="flex min-w-0 flex-col justify-center lg:border-r lg:border-white/10 lg:pr-5">
                    <p className="arena-kicker text-emerald-200">Settlement Quality</p>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-2xl font-black text-white sm:text-3xl">
                          {settlementQuality.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-white/54">
                          {settlementQuality.detail}
                        </p>
                      </div>
                      <p className="shrink-0 text-5xl font-black leading-none text-emerald-100">
                        {settlementQuality.score}
                      </p>
                    </div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-200"
                        style={{ width: `${settlementQuality.score}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col">
                    <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
                      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                        <p className="text-white/38">XP earned</p>
                        <p className="mt-1 text-emerald-100">{settlementXp.totalXp} XP</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                        <p className="text-white/38">Quality bonus</p>
                        <p className="mt-1 text-emerald-100">
                          +{settlementXp.satisfactionBonus} XP
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs font-semibold leading-5 text-white/52">
                      Base {settlementXp.baseXp} XP plus a bonus for how satisfied both parties
                      were.
                    </p>
                    <Link
                      href="/dashboard"
                      className="arena-btn-light mt-3 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm"
                    >
                      Back to Dashboard
                      <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
                <p className="border-t border-white/10 px-4 py-3 text-center text-xs font-semibold leading-5 text-white/46 sm:px-5">
                  This matter is closed. Pick up another case from your docket.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="arena-surface overflow-hidden">
              <div className="border-b border-white/10 p-4 sm:p-5">
                <p className="arena-kicker text-emerald-200">Final Agreement</p>
                <h3 className="mt-2 text-2xl font-black text-white">Terms both sides accepted</h3>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                {finalAgreementTerms.map((term) => {
                  const Icon = term.icon;

                  return (
                    <article
                      key={`settled-${term.label}`}
                      className="rounded-xl border border-emerald-200/12 bg-emerald-200/[0.035] p-4"
                    >
                      <div className="flex gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-emerald-200/20 bg-black/22 text-emerald-100">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-emerald-200">
                            {term.label}
                          </p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                            {term.value}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4">
              <section className="arena-surface p-4 sm:p-5">
                <p className="arena-kicker text-emerald-200">Accepted By</p>
                <div className="mt-4 space-y-3">
                  {[
                    [
                      playerPartyName,
                      playerRoleLabel,
                      HeroIcons.UserIcon,
                      settlementQuality.playerSatisfaction,
                    ],
                    [
                      opponentPartyName,
                      opponentRoleLabel,
                      HeroIcons.BuildingOffice2Icon,
                      settlementQuality.opponentSatisfaction,
                    ],
                  ].map(([name, role, Icon, satisfaction]) => (
                    <div
                      key={`accepted-${name}`}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-emerald-200/18 bg-emerald-200/[0.06] text-emerald-100">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{name}</p>
                          <p className="mt-0.5 text-xs font-semibold text-white/42">{role}</p>
                        </div>
                        <p className="ml-auto shrink-0 text-sm font-black text-emerald-100">
                          {satisfaction}%
                        </p>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-200"
                          style={{ width: `${satisfaction}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="arena-surface p-4 sm:p-5">
                <p className="arena-kicker text-amber-200">Closeout</p>
                <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-white/64">
                  <p className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    No further settlement messages are needed.
                  </p>
                  <p className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    The case outcome is recorded as a settlement on {completedAtLabel}.
                  </p>
                </div>
              </section>
            </aside>
          </section>

          <section className="arena-surface p-4 sm:p-5">
            <p className="arena-kicker text-emerald-200">Outcome</p>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/72">
              {finalAgreementSummary}
            </p>
          </section>

          {settlementHumanTranscript.length ? (
            <section className="arena-surface overflow-hidden">
              <div className="border-b border-white/10 p-4 sm:p-5">
                <p className="arena-kicker text-white/46">Settlement Record</p>
                <h3 className="mt-2 text-xl font-black text-white">Last negotiation moves</h3>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-3 sm:p-5">
                {settlementHumanTranscript.slice(-3).reverse().map((entry, index) => (
                  <article
                    key={`${entry.createdAt || index}-settled-record`}
                    className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/46">
                        {entry.role === "player" ? "You" : entry.speaker || "Opponent"}
                      </p>
                      <p className="text-xs font-semibold text-white/34">
                        {formatSettlementEntryTime(entry.createdAt)}
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/68">
                      {summarizeSettlementEntry(entry)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      );
    }

    const useSplitSettlementLayout = true;
    if (useSplitSettlementLayout) {
      return (
      <div id="settlement" className="mx-auto w-full max-w-[1600px] space-y-4">
        <section className="arena-surface overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-200/18 bg-amber-200/[0.07] text-amber-200">
                <HeroIcons.ScaleIcon className="h-8 w-8" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="arena-kicker text-amber-200">Settlement Negotiation</p>
                <h2 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">
                  Prepare the next offer
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/58">
                  Work through the terms with your client privately before saying anything to the other side.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                className="btn btn-ghost min-h-0 rounded-xl border border-amber-200/12 bg-white/[0.02] px-4 py-2 text-sm font-black normal-case text-amber-100 hover:border-amber-200/24 hover:bg-white/[0.04]"
                onClick={() => {
                  setIsSettlementInfoModalOpen(false);
                  requestSettlementTour();
                }}
                onPointerDown={triggerSettlementHaptic}
                aria-label="Take the settlement tour"
                title="Settlement tour"
              >
                <HeroIcons.QuestionMarkCircleIcon className="h-4 w-4" aria-hidden="true" />
                Tour
              </button>
              <button
                type="button"
                className="arena-btn-dark inline-flex min-h-0 items-center gap-2 px-4 py-2 text-sm"
                onClick={handleSettlementExit}
                onPointerDown={triggerSettlementHaptic}
                disabled={working || settlementIsTerminal}
              >
                Return to Intake
                <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px_minmax(0,1fr)]"
          data-settlement-tour-target="settlement-status"
        >
          <div
            className="rounded-2xl border border-emerald-300/[0.08] bg-emerald-300/[0.045] p-4 sm:p-5"
            data-settlement-tour-target="settlement-offer"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <SettlementPartyPortrait
                  image={caseSession.clientPortrait?.image}
                  name={playerPartyName}
                  tone="emerald"
                  fallbackIcon={HeroIcons.UserIcon}
                />
                <div className="min-w-0">
                  <p className="arena-kicker text-emerald-200">Private Client Huddle</p>
                  <h3 className="mt-1 truncate text-2xl font-black text-white">
                    {playerPartyName}
                  </h3>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-300/[0.08] bg-black/22 px-3 py-2">
                <span className="text-lg" aria-hidden="true">{getSettlementMoodEmoji(settlementClientMood)}</span>
                <div className="min-w-0">
                  <p className="text-xs font-black leading-4 text-white">
                    {describeSettlementMood(settlementClientMood)}
                    <span className="ml-1 text-white/48">{formatSettlementMoodScore(settlementClientMood)}</span>
                  </p>
                  <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.08]">
                    <span
                      className={`block h-full rounded-full ${
                        settlementClientMood >= 0 ? "bg-emerald-300" : "bg-red-300"
                      }`}
                      style={{ width: `${Math.max(8, Math.min(100, Math.abs(settlementClientMood)))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`mt-4 rounded-xl border p-4 ${clientReactionTone.card}`}
              data-settlement-tour-target="settlement-client-reaction"
            >
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${clientReactionTone.icon}`}>
                  <ClientReactionIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-black uppercase tracking-[0.14em] ${clientReactionTone.text}`}>
                    {playerPartyName} says
                  </p>
                  <p className="mt-2 text-xl font-black leading-snug text-white">
                    &quot;{clientSpokenLine}&quot;
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-300/[0.075] bg-black/18 px-3 py-1.5 text-xs font-semibold text-white/58">
                      {clientAcceptanceReason}
                    </span>
                    {visibleClientReactionDrivers.slice(0, 2).map((driver) => (
                      <span
                        key={driver}
                        className="rounded-full border border-white/[0.045] bg-black/18 px-3 py-1.5 text-xs font-semibold text-white/52"
                      >
                        {driver}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <form
              className="mt-4 rounded-xl border border-emerald-300/[0.065] bg-black/18 p-3"
              onSubmit={handleSettlementClientInstructionSubmit}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="arena-kicker text-emerald-200">Private huddle</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-white/62">
                    Ask your client privately before you reply.
                  </p>
                </div>
                <button
                  type="button"
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/[0.09] bg-black/35 text-emerald-100 shadow-inner shadow-black/30 transition hover:border-emerald-200/24 hover:bg-emerald-300/[0.08] disabled:cursor-not-allowed disabled:bg-black/24 disabled:text-emerald-100/38 ${
                    recordingSettlementClientInstruction ? "animate-pulse border-red-300/40 text-red-100" : ""
                  }`}
                  onClick={handleSettlementClientInstructionVoiceInput}
                  disabled={
                    clientWalkoutActive ||
                    settlementClientInstructionWorking ||
                    transcribingSettlementClientInstruction
                  }
                  aria-label={recordingSettlementClientInstruction ? "Stop client voice note" : "Record client voice note"}
                  title={recordingSettlementClientInstruction ? "Stop recording" : "Record voice note"}
                >
                  <HeroIcons.MicrophoneIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  hasConcreteLatestOpponentTerms
                    ? "Is this offer within your acceptable range?"
                    : "What range of terms would be acceptable?",
                  "What amount would you actually accept?",
                  "Can we trade timing for a lower amount?",
                  "What term is non-negotiable?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-full border border-emerald-300/[0.08] bg-emerald-300/[0.045] px-3 py-1.5 text-xs font-semibold text-emerald-50 transition hover:border-emerald-200/20 hover:bg-emerald-300/[0.08]"
                    onClick={() => setSettlementClientInstruction(prompt)}
                    disabled={clientWalkoutActive || settlementClientInstructionWorking}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.04] bg-black/22">
                <textarea
                  value={settlementClientInstruction}
                  onChange={(event) => setSettlementClientInstruction(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "Enter" ||
                      event.shiftKey ||
                      event.nativeEvent?.isComposing
                    ) {
                      return;
                    }

                    event.preventDefault();
                    if (
                      !clientWalkoutActive &&
                      !settlementClientInstructionWorking &&
                      !transcribingSettlementClientInstruction &&
                      settlementClientInstruction.trim()
                    ) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={2}
                  className="block min-h-20 w-full resize-none border-0 bg-transparent px-3 py-3 text-sm font-semibold leading-5 text-white outline-none placeholder:text-white/32"
                  placeholder={`Ask ${playerPartyName} privately...`}
                  disabled={clientWalkoutActive || settlementClientInstructionWorking}
                />
                <div className="flex items-center justify-between gap-3 border-t border-white/[0.035] px-3 py-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.08]">
                    <span
                      className="block h-full rounded-full bg-emerald-300 transition-[width]"
                      style={{
                        width: recordingSettlementClientInstruction
                          ? `${Math.max(8, Math.round(settlementClientInstructionAudioLevel * 100))}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-white/40">
                    {transcribingSettlementClientInstruction
                      ? "Transcribing..."
                      : recordingSettlementClientInstruction
                      ? "Listening..."
                      : "Private"}
                  </span>
                </div>
              </div>
              <button
                type="submit"
                className="arena-btn-light mt-3 inline-flex min-h-0 w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
                disabled={
                  settlementClientInstructionWorking ||
                  clientWalkoutActive ||
                  transcribingSettlementClientInstruction ||
                  !settlementClientInstruction.trim()
                }
              >
                {settlementClientInstructionWorking ? "Asking client..." : "Ask client privately"}
                <HeroIcons.ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          <div
            className="rounded-2xl border border-amber-200/[0.08] bg-amber-200/[0.05] p-4 text-center"
            data-settlement-tour-target="settlement-viability"
          >
            <p className="arena-kicker text-amber-200">Do This Next</p>
            {clientAuthorizedLatestOffer ? (
              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-black shadow-[0_12px_28px_rgba(16,185,129,0.16)] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleAcceptSettlementTerms}
                onPointerDown={triggerSettlementHaptic}
                disabled={settlementActionsLocked}
              >
                {pendingAction === "settlement-accept" ? "Accepting terms..." : "Accept terms"}
                <HeroIcons.CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-black shadow-[0_12px_28px_rgba(16,185,129,0.16)] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleAskClientAboutLatestOffer}
                onPointerDown={triggerSettlementHaptic}
                disabled={settlementActionsLocked || settlementClientInstructionWorking}
              >
                {settlementClientInstructionWorking
                  ? "Asking client..."
                  : settlementClientPreview
                  ? "Ask client follow-up"
                  : "Ask client first"}
                <HeroIcons.UserIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {!clientAuthorizedLatestOffer ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-white/46">
                {settlementClientPreview?.authorityReason
                  ? settlementClientPreview.authorityReason
                  : hasConcreteLatestOpponentTerms
                  ? "Acceptance unlocks only after your client says the latest offer is within authority."
                  : "No definite offer can be accepted yet. Ask your client what range of terms to send."}
              </p>
            ) : settlementAcceptAuthority.reason ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-emerald-100/72">
                {settlementAcceptAuthority.reason}
              </p>
            ) : null}
            <button
              type="button"
              className="arena-btn-light mt-3 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setSettlementMessageAndFocus(getSettlementComposerDefaultMessage)}
              onPointerDown={triggerSettlementHaptic}
              disabled={settlementActionsLocked}
            >
              {awaitingNegotiationResponse ? "Waiting for response" : "Message opposing counsel"}
              {awaitingNegotiationResponse ? (
                <HeroIcons.ClockIcon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <HeroIcons.PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {analyticsMode !== "pvp" ? (
              <button
                type="button"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-300/[0.12] bg-red-300/[0.055] px-4 py-2.5 text-sm font-black text-red-100 transition hover:border-red-300/[0.22] hover:bg-red-300/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSettlementExit}
                onPointerDown={triggerSettlementHaptic}
                disabled={working || pendingAction === "settlement-exit" || settlementIsTerminal}
              >
                {pendingAction === "settlement-exit" ? "Exiting settlement..." : "Exit settlement"}
                <HeroIcons.ArrowUturnLeftIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            {analyticsMode === "pvp" ? (
              <button
                type="button"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-300/[0.055] px-4 py-2.5 text-sm font-black text-red-100 transition hover:bg-red-300/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSettlementExit}
                onPointerDown={triggerSettlementHaptic}
                disabled={working || pendingAction === "settlement-exit"}
              >
                {pendingAction === "settlement-exit" ? "Ending negotiations..." : "End negotiations"}
                <HeroIcons.ArrowUturnLeftIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div
            className="rounded-2xl border border-red-300/[0.08] bg-red-300/[0.04] p-4 sm:p-5"
            data-settlement-tour-target="settlement-public-terms"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <SettlementPartyPortrait
                  image={caseSession.opponentPortrait?.image}
                  name={opponentPartyName}
                  tone="red"
                  fallbackIcon={HeroIcons.BuildingOffice2Icon}
                />
                <div className="min-w-0">
                  <p className="arena-kicker text-red-200">Other Side&apos;s Last Offer</p>
                  <h3 className="mt-1 truncate text-2xl font-black text-white">
                    {opponentPartyName}
                  </h3>
                </div>
              </div>
              <div className="w-full sm:w-56">
                <SettlementMoodMeter
                  value={settlementOpponentMood}
                  label="Opposing client"
                  moodLabel={describeSettlementMood(settlementOpponentMood)}
                  compact
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-red-300/[0.055] bg-black/18 p-4">
              <p className="arena-kicker text-red-200">Other Side&apos;s Position</p>
              <p className="mt-2 text-sm leading-6 text-white/72">{opponentAcceptanceReason}</p>
            </div>

            <div className="mt-4 rounded-xl border border-red-300/[0.055] bg-black/18 p-4">
              <p className="arena-kicker text-red-200">Last exchanged proposal</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/72">
                {latestOpponentOfferText || "No freeform proposal has been sent by the other side yet."}
              </p>
            </div>

            <p className="arena-kicker mt-5 text-red-200">Breakdown</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-white/42">
              Quick reference pulled from the proposal text.
            </p>
            <div className="mt-3 space-y-2">
              {sidePanelTermRows.length ? sidePanelTermRows.map((term) => {
                const Icon = term.icon;

                return (
                  <div
                    key={`opponent-${term.label}`}
                    className="grid grid-cols-[2.25rem_minmax(0,0.85fr)_minmax(0,1fr)] items-center gap-3 rounded-xl border border-white/[0.04] bg-black/20 px-3 py-2.5"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-red-300/[0.065] bg-red-300/8 text-red-200">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 truncate text-[0.65rem] font-black uppercase tracking-[0.13em] text-white/52">
                      {term.label}
                    </span>
                    <span className="min-w-0 text-sm font-semibold leading-5 text-white/82">
                      {term.value}
                    </span>
                  </div>
                );
              }) : (
                <div className="rounded-xl border border-white/[0.035] bg-black/16 px-3 py-3 text-sm font-semibold leading-5 text-white/46">
                  No separate terms were stated. Read the proposal text above as the source of truth.
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-red-300/[0.09] bg-red-300/[0.075] p-3">
              <div className="flex gap-3">
                <HeroIcons.ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-200" aria-hidden="true" />
                <p className="text-sm leading-5 text-red-50">
                  <span className="font-black">Main blocker:</span> {blockerText}
                </p>
              </div>
            </div>
          </div>
        </section>

        {!settlementIsTerminal ? (
          <section className="arena-surface overflow-hidden" data-settlement-tour-target="settlement-next-move">
            <div className="border-b border-amber-200/10 p-4 sm:p-5">
              {settlementClientCounselNote ? (
                <div className="rounded-2xl border border-amber-200/[0.07] bg-amber-200/[0.055] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="arena-kicker text-amber-200">Private note to client</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-amber-50">
                        {settlementClientCounselNote}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="arena-btn-dark shrink-0 px-4 py-2 text-sm"
                      onClick={handleSettlementExit}
                      onPointerDown={triggerSettlementHaptic}
                      disabled={working}
                    >
                      Walk away now
                    </button>
                  </div>
                </div>
              ) : null}

              <p className={`arena-kicker text-amber-200 ${settlementClientCounselNote ? "mt-5" : ""}`}>
                Your Next Move
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {settlementNextMoveActions.map(({ title, body, icon: Icon, tone, featured, onClick }) => (
                  <button
                    key={title}
                    type="button"
                    className={`min-h-[5.5rem] rounded-xl border p-4 text-left transition ${
                      featured
                        ? "border-amber-200/[0.16] bg-amber-200/[0.08]"
                        : tone === "red"
                        ? "border-red-300/[0.055] bg-red-300/[0.035] hover:border-red-300/[0.12]"
                        : tone === "emerald"
                        ? "border-emerald-300/[0.055] bg-emerald-300/[0.035] hover:border-emerald-300/[0.12]"
                        : "border-amber-200/[0.05] bg-amber-200/[0.035] hover:border-amber-200/[0.11]"
                    }`}
                    onClick={onClick}
                    disabled={settlementActionsLocked}
                  >
                    <div className="flex gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.045] bg-black/20 text-amber-100">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block font-black text-white">{title}</span>
                        <span className="mt-1 block text-sm leading-5 text-white/56">{body}</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </section>
        ) : null}

        {settlementComposeModal}

        {settlement.outcomeSummary || settlement.failureReason ? (
          <section className="arena-surface p-4 sm:p-6">
            <p className="arena-kicker">{isSettled ? "Outcome" : "Status"}</p>
            <p className="mt-3 text-sm leading-6 text-white/72">
              {settlement.outcomeSummary || settlement.failureReason}
            </p>
          </section>
        ) : null}
      </div>
      );
    }

    return (
      <div id="settlement" className="settlement-cockpit mx-auto w-full max-w-[1600px]">
        <section className="arena-surface settlement-cockpit-surface overflow-hidden bg-amber-200/[0.018]">
          <div className="space-y-5 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="mt-1 hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/12 bg-amber-200/[0.07] text-amber-200 sm:flex">
                  <HeroIcons.UserGroupIcon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-2xl font-black text-white sm:text-3xl">
                    {isSettled ? "Agreement Reached" : settlement.status === "failed" ? "Talks Broke Down" : "Negotiation Room"}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/58">
                    Reach a fair resolution that saves time, money, and stress.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  className="btn btn-ghost settlement-interactive min-h-0 rounded-xl border border-amber-200/10 bg-white/[0.018] px-3 py-2 text-sm font-black normal-case text-amber-100 hover:border-amber-200/20 hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200/45"
                  onClick={() => {
                    setIsSettlementInfoModalOpen(false);
                    requestSettlementTour();
                  }}
                  onPointerDown={triggerSettlementHaptic}
                  aria-label="Take the settlement tour"
                  title="Settlement tour"
                >
                  <HeroIcons.QuestionMarkCircleIcon className="h-4 w-4" aria-hidden="true" />
                  Tour
                </button>
                <button
                  type="button"
                  className="arena-btn-dark settlement-interactive inline-flex min-h-0 items-center gap-2 px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200/45"
                  onClick={handleSettlementExit}
                  onPointerDown={triggerSettlementHaptic}
                  disabled={working || settlementIsTerminal}
                >
                  Return to Intake
                  <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-settlement-tour-target="settlement-status">
              {statusCards.map((card) => {
                const Icon = card.icon;
                const tone = toneClasses[card.tone];

                return (
                  <div key={card.title} className={`settlement-interactive rounded-xl border p-4 ${tone.card}`}>
                    <div className="flex items-center gap-3">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${tone.icon}`}>
                        {card.emoji ? (
                          <span className="text-2xl leading-none" aria-hidden="true">{card.emoji}</span>
                        ) : (
                          <Icon className="h-6 w-6" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[0.65rem] font-black uppercase tracking-[0.16em] ${tone.text}`}>{card.title}</p>
                        <p className="mt-1 truncate text-sm font-black text-white">{card.value.replace("â€¢", "·")}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="h-px bg-amber-200/[0.055]" />

            <section data-settlement-tour-target="settlement-offer">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <HeroIcons.CurrencyDollarIcon className="mt-0.5 h-6 w-6 text-amber-200" aria-hidden="true" />
                  <div>
                    <h3 className="text-xl font-black text-white">Current Offer</h3>
                    <p className="mt-1 text-sm font-semibold text-white/48">These are the terms on the table.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="arena-btn-dark settlement-interactive inline-flex min-h-0 items-center justify-center gap-2 px-4 py-2 text-sm text-amber-100 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200/45"
                  onPointerDown={triggerSettlementHaptic}
                  onClick={() => setSettlementMessageAndFocus((current) =>
                    current.trim() || settlementDraftMessage
                  )}
                  disabled={settlementActionsLocked}
                >
                  <HeroIcons.PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                  Edit offer
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {offerTiles.map((tile) => {
                  const Icon = tile.icon;

                  return (
                    <div key={tile.label} className="settlement-interactive rounded-xl border border-amber-200/8 bg-black/24 p-4 hover:bg-amber-200/[0.022]">
                      <div className="flex items-center gap-4">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-emerald-300/10 bg-emerald-300/[0.06] text-emerald-200">
                          <Icon className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/38">{tile.label}</p>
                          <p className="mt-1 line-clamp-2 text-base font-black leading-5 text-white">{tile.value}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="h-px bg-amber-200/[0.055]" />

            <section data-settlement-tour-target="settlement-viability">
              <div className="mb-3 flex items-center gap-2">
                <HeroIcons.UserGroupIcon className="h-5 w-5 text-amber-200" aria-hidden="true" />
                <h3 className="text-lg font-black text-white">Client moods</h3>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.045] p-3">
                  <SettlementMoodMeter
                    value={settlementClientMood}
                    label={`Your client - ${clientAcceptance.label}`}
                    moodLabel={describeSettlementMood(settlementClientMood)}
                    reason={clientAcceptanceReason}
                  />
                </div>

                <div className="rounded-xl border border-red-300/10 bg-red-300/[0.045] p-3">
                  <SettlementMoodMeter
                    value={settlementOpponentMood}
                    label={`Opponent - ${opponentAcceptance.label}`}
                    moodLabel={describeSettlementMood(settlementOpponentMood)}
                    reason={opponentAcceptanceReason}
                  />
                </div>
              </div>
            </section>

            <div className="rounded-xl border border-amber-200/12 bg-amber-200/[0.06] p-4" data-settlement-tour-target="settlement-next-move">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <HeroIcons.LightBulbIcon className="mt-0.5 h-6 w-6 shrink-0 text-amber-200" aria-hidden="true" />
                  <div>
                    <p className="text-base font-black text-amber-100">Recommended next move</p>
                    <p className="mt-1 text-sm leading-5 text-white/68">{actionableNextMove}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className="arena-btn-light settlement-interactive min-h-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200/45"
                    onPointerDown={triggerSettlementHaptic}
                    onClick={() => setSettlementMessageAndFocus((current) => current.trim() || actionableNextMove)}
                    disabled={settlementActionsLocked}
                  >
                    Draft this approach
                  </button>
                  <button
                    type="button"
                    className="arena-btn-dark settlement-interactive min-h-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200/45"
                    onPointerDown={triggerSettlementHaptic}
                    onClick={() => setSettlementMessageAndFocus((current) =>
                      current.trim() || settlementDraftMessage
                    )}
                    disabled={settlementActionsLocked}
                  >
                    Edit offer
                  </button>
                </div>
              </div>
            </div>

            <section data-settlement-tour-target="settlement-recent">
              <div className="mb-3 flex items-center gap-2">
                <HeroIcons.ChatBubbleLeftRightIcon className="h-5 w-5 text-amber-200" aria-hidden="true" />
                <h3 className="text-lg font-black text-white">Recent exchanges</h3>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {recentSettlementEntries.length ? (
                  recentSettlementEntries.map((entry, index) => {
                    const isPlayerEntry = entry.isViewer || (entry.role === "player" && entry.isViewer !== false);
                    const label = isPlayerEntry ? "You" : "Opponent";

                    return (
                      <article key={`${entry.createdAt || index}-recent`} className={`settlement-interactive rounded-xl border p-4 ${isPlayerEntry ? "border-emerald-300/10 bg-emerald-300/[0.035]" : "border-red-300/10 bg-red-300/[0.035]"}`}>
                        <p className={`text-xs font-black ${isPlayerEntry ? "text-emerald-200" : "text-red-200"}`}>
                          {label}
                          {formatSettlementEntryTime(entry.createdAt) ? (
                            <span className="ml-2 font-semibold text-white/35">{formatSettlementEntryTime(entry.createdAt)}</span>
                          ) : null}
                        </p>
                        <p className="mt-2 text-sm leading-5 text-white/68">{summarizeSettlementEntry(entry)}</p>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-amber-200/10 bg-amber-200/[0.03] p-4 text-sm text-white/48 lg:col-span-3">
                    No settlement messages yet.
                  </div>
                )}
              </div>
            </section>

            <section data-settlement-tour-target="settlement-support">
              <div className="mb-3 flex items-center gap-2">
                <HeroIcons.FolderIcon className="h-5 w-5 text-amber-200" aria-hidden="true" />
                <h3 className="text-lg font-black text-white">Supporting info</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {supportItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="btn btn-ghost settlement-interactive h-auto min-h-16 w-full justify-between rounded-xl border border-amber-200/10 bg-white/[0.018] px-4 py-3 text-left normal-case text-white hover:border-amber-200/20 hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200/45"
                      onPointerDown={triggerSettlementHaptic}
                      onClick={() => openSettlementInfo(item.key)}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon className="h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-white/78">{item.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-white/38">{item.detail}</span>
                        </span>
                      </span>
                      <HeroIcons.ChevronRightIcon className="h-4 w-4 shrink-0 text-white/38" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </section>

        {settlementComposeModal}

        <div
          className={`modal modal-bottom sm:modal-middle ${isSettlementInfoModalOpen ? "modal-open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-hidden={!isSettlementInfoModalOpen}
          aria-label={`${activeSupportItem.label} supporting info`}
        >
            <div className="modal-box max-h-[86vh] overflow-hidden rounded-t-2xl border border-amber-200/10 bg-[#070908] p-0 text-white shadow-2xl shadow-black/70 sm:w-[min(42rem,calc(100vw-3rem))] sm:max-w-2xl sm:rounded-2xl">
              <div className="border-b border-white/[0.06] bg-[#070908]/95 p-4 backdrop-blur sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="badge badge-outline border-amber-200/25 bg-amber-200/5 text-[0.68rem] font-black uppercase tracking-[0.18em] text-amber-100">
                      Supporting info
                    </span>
                    <h3 className="mt-3 text-xl font-black leading-tight text-white">{activeSupportItem.label}</h3>
                    <p className="mt-1 text-sm text-white/48">{activeSupportItem.detail}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-circle btn-ghost btn-sm shrink-0 border border-white/[0.06] text-white/65 hover:border-amber-200/25 hover:bg-white/[0.04] hover:text-white"
                    onClick={closeSettlementInfo}
                    aria-label="Close supporting info"
                  >
                    <HeroIcons.XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="arena-scroll max-h-[64vh] space-y-3 overflow-y-auto p-4 sm:p-5">
                {(settlementInfoRows[activeSettlementInfoKey] || []).map(([title, items]) => {
                  const cleanItems = cleanDraftList(items);

                  return (
                    <section
                      key={`${activeSettlementInfoKey}-${title}`}
                      className="card card-compact border border-amber-200/10 bg-white/[0.018] shadow-sm shadow-black/20"
                    >
                      <div className="card-body p-4">
                        <span className="badge badge-outline border-amber-200/20 bg-amber-200/5 text-[0.68rem] font-black uppercase tracking-[0.14em] text-amber-100">
                          {title}
                        </span>
                      {cleanItems.length ? (
                        <ul className="mt-3 space-y-2">
                          {cleanItems.map((item, index) => (
                            <li key={`${title}-${index}`} className="text-sm leading-6 text-white/68">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-white/42">No details available yet.</p>
                      )}
                      </div>
                    </section>
                  );
                })}
              </div>
              <div className="modal-action border-t border-white/[0.06] bg-[#070908]/95 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  className="btn btn-outline btn-sm border-amber-200/20 text-amber-100 hover:border-amber-200/40 hover:bg-amber-200/10 hover:text-amber-50"
                  onClick={closeSettlementInfo}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="modal-backdrop bg-black/55 backdrop-blur-[2px]">
              <button
                type="button"
                aria-label="Close supporting info"
                onClick={closeSettlementInfo}
              >
                close
              </button>
            </div>
          </div>

        {settlement.outcomeSummary || settlement.failureReason ? (
          <section className="arena-surface p-4 sm:p-6">
            <p className="arena-kicker">{isSettled ? "Outcome" : "Status"}</p>
            <p className="mt-3 text-sm leading-6 text-white/72">
              {settlement.outcomeSummary || settlement.failureReason}
            </p>
          </section>
        ) : null}
      </div>
    );
  };

  const renderLawbookFilters = () => (
    <div className="mt-4 flex min-w-0 max-w-full flex-wrap gap-1.5 sm:mt-5 sm:gap-2">
      {lawbookFilterOptions.map((category) => {
        const isSelected = selectedLawbookCategory === category.slug;

        return (
          <button
            key={category.slug}
            type="button"
            className={`rounded-full border px-2.5 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] transition sm:px-3 sm:py-2 sm:text-xs sm:tracking-[0.12em] ${
              isSelected
                ? "border-amber-200/55 bg-amber-200/15 text-amber-100"
                : "border-white/10 bg-white/[0.03] text-white/48 hover:border-white/20 hover:text-white/75"
            }`}
            onClick={() => setSelectedLawbookCategory(category.slug)}
          >
            {category.title}
          </button>
        );
      })}
    </div>
  );

  const renderLawbookRuleCard = (rule, compact = false) => (
    <details
      key={rule.id}
      className="arena-surface-soft group/rule min-w-0 max-w-full overflow-hidden"
    >
      <summary className="flex min-w-0 cursor-pointer list-none items-center gap-3 p-3 sm:p-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200/15 bg-amber-200/10 text-amber-100">
          <LawbookRuleIcon icon={rule.icon} />
        </span>
        <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-white sm:text-[0.95rem]">
          {rule.title}
        </p>
        <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center text-white/55">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5 group-open/rule:hidden"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="hidden h-5 w-5 group-open/rule:block"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-white/8 px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
        <p className="text-xs uppercase tracking-[0.12em] text-white/36">
          {rule.universal
            ? "Universal"
            : (rule.categorySlugs || [])
                .map((slug) => categoryTitleBySlug.get(slug) || slug)
                .join(" | ")}
        </p>
        <p className="mt-3 text-sm leading-6 text-white/68">{rule.principle}</p>
        {!compact ? (
          <p className="mt-3 text-sm leading-6 text-white/50">{rule.guidance}</p>
        ) : null}
        <p className="mt-4 break-words text-xs uppercase tracking-[0.12em] text-white/40 sm:tracking-[0.15em]">
          {(rule.tags || []).join(" | ")}
        </p>
      </div>
    </details>
  );

  const renderLawbookPanel = (className = "", panelId = "lawbook-details") => (
    <div
      id={panelId}
      className={`arena-surface min-w-0 max-w-full overflow-hidden ${className}`}
    >
      <details className="group min-w-0 max-w-full" open>
        <summary className="list-none cursor-pointer p-4 sm:p-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="arena-kicker">Lawbook</p>
              <h2 className="arena-headline mt-2 text-2xl">Rules in play</h2>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs uppercase tracking-[0.15em] text-white/40">
                {visibleLawbookRules.length} of {lawbookRules.length} rules
              </span>
              <CollapseChevron />
            </div>
          </div>
          {renderLawbookFilters()}
        </summary>
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
          <label className="block min-w-0">
            <span className="sr-only">Search lawbook rules</span>
            <input
              type="search"
              className="arena-field min-h-0 w-full px-3 py-2.5 text-sm outline-none transition placeholder:text-white/35 focus:border-amber-200/45"
              placeholder="Search all rules"
              value={lawbookSearch}
              onChange={(event) => setLawbookSearch(event.target.value)}
            />
          </label>
          <p className="mb-4 mt-3 text-sm text-white/48">
            Showing {selectedLawbookCategoryTitle.toLowerCase()} rules plus universal
            courtroom principles.
          </p>
          <div className="grid min-w-0 max-w-full grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {visibleLawbookRules.length > 0 ? (
              visibleLawbookRules.map((rule) => renderLawbookRuleCard(rule))
            ) : (
              <div className="arena-surface-soft p-4 text-sm text-white/52">
                No rules match this search.
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  );

  const factSheetSections = [
    {
      key: "theory",
      title: "Theory",
      description: "Your working argument for why your side should win.",
      empty: "No theory notes yet.",
      placeholder: "My current theory is...",
    },
    {
      key: "timeline",
      title: "Timeline",
      description: "Key events in order, especially dates, notices, payments, and deadlines.",
      empty: "No timeline points yet.",
      placeholder: "Event and timing...",
    },
    {
      key: "supportingFacts",
      title: "Supporting facts",
      description: "Facts that help your side and are worth bringing up in court.",
      empty: "No supporting facts yet.",
      placeholder: "Helpful fact...",
    },
    {
      key: "risks",
      title: "Risks",
      description: "Weak points the judge or other side may use against you.",
      empty: "No risks captured yet.",
      placeholder: "Risk I need to manage...",
    },
    {
      key: "disputedFacts",
      title: "Disputed facts",
      description: "Facts your side and the other side are likely to fight about.",
      empty: "No disputed facts yet.",
      placeholder: "The other side may dispute...",
    },
    {
      key: "corroboratedFacts",
      title: "Corroborated facts",
      description: "Facts backed by photos, messages, receipts, witnesses, or other proof.",
      empty: "No corroborated facts yet.",
      placeholder: "Record or witness support...",
    },
    {
      key: "missingEvidence",
      title: "Missing evidence / proof gaps",
      description: "Amber means ask about it; red means it appears unavailable or outside your side's control.",
      empty: "No proof gaps listed yet.",
      placeholder: "I still need...",
    },
    {
      key: "desiredRelief",
      title: "Requested relief",
      description: "What you want the judge to order at the end of the case.",
      empty: "No relief notes yet.",
      placeholder: "Requested court order...",
    },
  ];

  const renderFactSheetSection = (section) => {
    const items = ensureDraftList(factSheetDraft[section.key]);
    const completedItems = cleanDraftList(items);
    const hasItems = completedItems.length > 0;
    const hasDraftRows = items.length > 0;

    return (
      <details
        key={section.key}
        className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]"
      >
        <summary className="list-none cursor-pointer px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">{section.title}</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    hasItems ? "bg-emerald-300" : "bg-white/18"
                  }`}
                />
              </div>
              <p className="mt-1 text-xs text-white/42">
                {completedItems.length} {completedItems.length === 1 ? "item" : "items"}
              </p>
            </div>
            <CollapseChevron />
          </div>
        </summary>
        <div className="border-t border-white/8 px-4 pb-4 pt-3">
          {section.description ? (
            <p className="mb-3 text-sm italic leading-6 text-white/48">
              {section.description}
            </p>
          ) : null}

          {hasDraftRows ? (
            <div className="space-y-3">
              {items.map((item, itemIndex) => {
                const bulletTone = getFactSheetItemTone(section.key, item);

                return (
                  <div
                    key={`${section.key}-${itemIndex}`}
                    className="flex gap-3"
                  >
                    <span
                      className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        factSheetBulletToneClass[bulletTone] || factSheetBulletToneClass.secondary
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-7 text-white/78">
                        {section.key === "missingEvidence"
                          ? formatMissingEvidenceLabel(item)
                          : item}
                      </p>
                      {isInterview && section.key === "missingEvidence" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getEvidenceFollowUpQuestions(item)
                            .slice(0, 2)
                            .map((questionText) => (
                              <button
                                key={`${section.key}-${itemIndex}-${questionText}`}
                                type="button"
                                className="rounded-full border border-amber-200/16 bg-amber-200/[0.055] px-3 py-1.5 text-left text-xs font-semibold text-amber-100 transition hover:border-amber-200/38 hover:bg-amber-200/10"
                                onClick={() => applySuggestedIntakeQuestion(questionText)}
                                disabled={awaitingSettlementResponse || settlementAuthorityReady}
                              >
                                {questionText}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 bg-black/15 p-4 text-sm text-white/42">
              {section.empty}
            </div>
          )}
        </div>
      </details>
    );
  };

  const activeMobileFactSheetSection =
    factSheetSections.find((section) => section.key === activeMobileFactSheetKey) ||
    factSheetSections[0];
  const activeMobileFactSheetItems = activeMobileFactSheetSection
    ? ensureDraftList(factSheetDraft[activeMobileFactSheetSection.key])
    : [];

  const openMobileFactSheetDialog = (sectionKey) => {
    if (awaitingSettlementResponse) {
      return;
    }

    setActiveMobileFactSheetKey(sectionKey);
    setShowMobileFactSheetDialog(true);
  };

  const getFactSheetProgressButtonClass = (sectionKey) => {
    if (!recentFactSheetProgress[sectionKey]) {
      return "";
    }

    return highRewardFactSheetSections.has(sectionKey)
      ? " arena-fact-progress-pop arena-fact-progress-glow !border-emerald-200/70 !bg-emerald-300/16 !text-emerald-50"
      : " arena-fact-progress-pop !border-amber-200/65 !bg-amber-200/14 !text-amber-50";
  };

  const renderFactSheetProgressBadge = (sectionKey) => {
    const gainedItems = recentFactSheetProgress[sectionKey];

    if (!gainedItems) {
      return null;
    }

    const isHighReward = highRewardFactSheetSections.has(sectionKey);

    return (
      <span
        className={`pointer-events-none absolute right-1 top-1 rounded-full border px-1.5 py-0.5 text-[0.55rem] font-black leading-none shadow-lg ${
          isHighReward
            ? "border-emerald-100/65 bg-emerald-200 text-emerald-950 shadow-emerald-950/30"
            : "border-amber-100/65 bg-amber-200 text-amber-950 shadow-amber-950/30"
        }`}
        aria-hidden="true"
      >
        +{gainedItems}
      </span>
    );
  };

  const renderMobileFactSheetButton = (section, className = "") => {
    const sectionCount = cleanDraftList(factSheetDraft[section.key]).length;
    const Icon = factSheetSectionIconMap[section.key] || HeroIcons.DocumentTextIcon;
    const isComplete = sectionCount > 0;
    const isSelected = activeMobileFactSheetKey === section.key;

    return (
      <button
        key={`mobile-${section.key}`}
        type="button"
        className={`relative min-h-[4.05rem] rounded-xl border p-2 text-center transition ${
          isSelected
            ? "border-amber-200/45 bg-amber-300/12 text-amber-100"
            : isComplete
            ? "border-emerald-300/25 bg-emerald-300/8"
            : "border-white/10 bg-white/[0.025]"
        } ${getFactSheetProgressButtonClass(section.key)} ${className}`}
        onClick={() => openMobileFactSheetDialog(section.key)}
        disabled={awaitingSettlementResponse || settlementAuthorityReady}
      >
        {renderFactSheetProgressBadge(section.key)}
        <Icon
          className={`mx-auto h-4 w-4 ${
            isSelected ? "text-amber-100" : isComplete ? "text-emerald-200" : "text-amber-200"
          }`}
          aria-hidden="true"
        />
        <span className="mt-1 block line-clamp-1 text-[0.56rem] font-semibold text-white/74">
          {factSheetSectionCompactLabel[section.key] || section.title}
        </span>
        <span className="mt-0.5 block text-[0.6rem] text-white/42">
          {sectionCount}/{Math.max(sectionCount, 1)}
        </span>
      </button>
    );
  };

  return (
    <main
      ref={settlementTopRef}
      className="arena-app-shell min-h-screen overflow-x-hidden px-3 pb-24 pt-4 sm:px-4 sm:py-6 md:px-8 md:py-10"
    >
      <section className="mx-auto max-w-[1600px] space-y-6 arena-reveal">
        <div className="sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-white/72"
              aria-label="Back to cases"
            >
              <HeroIcons.ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
              Legal Arena
            </p>
            <div className="flex items-center gap-2">
              {isInterview || isCourtroom ? (
                <button
                  type="button"
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-300/22 bg-rose-500/10 px-3 text-xs font-semibold text-rose-100 transition hover:border-rose-200/45 hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={handleExitCase}
                  disabled={working || awaitingSettlementResponse}
                  aria-label={apiConfig.exitLabel || "Exit case"}
                >
                  <HeroIcons.XMarkIcon className="h-4 w-4" aria-hidden="true" />
                  {pendingAction === "exit"
                    ? apiConfig.exitPendingLabel || "Exiting..."
                    : apiConfig.exitLabel || "Exit Case"}
                </button>
              ) : null}
              <ButtonAccount />
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-semibold leading-tight text-white">
            {caseSession.title}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
            {isSettlement || isSettled
              ? settlementCaseContextLine
              : `${playerRepresentationLabel} ${interviewContextLabel}`}
          </p>
          <div className="mt-3 flex items-center gap-2 overflow-hidden">
            <CountryBadge caseCountry={caseSession.caseCountry} className="shrink-0" />
            <span
              className={`min-w-0 max-w-[58vw] truncate rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                caseSession.playerSide === "opponent"
                  ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
                  : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              }`}
              title={sideBadgeLabel}
            >
              {sideBadgeLabel}
            </span>
            <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs font-semibold text-white/72">
              {isCourtroom ? courtroomRoundLabel : courtroomStageLabel}
            </span>
            {!isSettlement && !isSettled && Number.isFinite(Number(displayedSuccessChance)) ? (
              <span
                className="shrink-0 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100"
                data-tooltip-id="success-chance-tooltip"
                aria-label={successChanceLabel}
              >
                Win chance {Math.round(Number(displayedSuccessChance))}%
              </span>
            ) : null}
            {courtroomDeadlineLabel ? (
              <span className="shrink-0 rounded-lg border border-amber-200/25 bg-amber-200/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                {courtroomDeadlineLabel}
              </span>
            ) : null}
          </div>
          {!isSettlement && !isSettled ? (
            <div className="mt-4 grid grid-cols-3 border-y border-white/10 text-xs font-semibold text-white/62">
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-3 transition hover:text-white"
                onClick={() => setShowMobileBriefDialog(true)}
              >
                <HeroIcons.DocumentTextIcon className="h-4 w-4" aria-hidden="true" />
                Brief
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-3 transition hover:text-white"
                onClick={() => openMobileFactSheetDialog(activeMobileFactSheetKey)}
              >
                <HeroIcons.ClipboardDocumentListIcon className="h-4 w-4" aria-hidden="true" />
                Fact Sheet
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-3 transition hover:text-white"
                onClick={() => setShowMobileLawbookDialog(true)}
              >
                <HeroIcons.BookOpenIcon className="h-4 w-4" aria-hidden="true" />
                Lawbook
              </button>
            </div>
          ) : null}
        </div>

        <div
          id="case-brief-desktop"
          className="arena-surface hidden overflow-hidden sm:block"
        >
          <div className={`border-b border-white/10 ${isSettlement || isSettled ? "p-3 sm:p-4" : "p-4 sm:p-5"}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href="/dashboard"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-white/72 transition hover:border-white/20 hover:text-white"
                  aria-label="Back to cases"
                >
                  <HeroIcons.ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
                </Link>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
                    Legal Arena
                  </p>
                  <h1 className={`mt-1 truncate font-semibold leading-tight text-white ${isSettlement || isSettled ? "text-xl" : "text-2xl"}`}>
                    {caseSession.title}
                  </h1>
                  <p className="mt-1 truncate text-sm font-semibold text-white/58">
                    {isSettlement || isSettled
                      ? settlementCaseContextLine
                      : `${playerRepresentationLabel} ${interviewContextLabel}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <CountryBadge caseCountry={caseSession.caseCountry} />
                <span
                  className={`min-w-0 max-w-xs truncate rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    caseSession.playerSide === "opponent"
                      ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
                      : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                  }`}
                  title={sideBadgeLabel}
                >
                  {sideBadgeLabel}
                </span>
                <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs font-semibold text-white/62">
                  {sideContextLabel}
                </span>
                <span
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold arena-status ${
                    statusTone[caseSession.status] || "arena-status-neutral"
                  }`}
                >
                  {isCourtroom ? courtroomRoundLabel : courtroomStageLabel}
                </span>
                {!isSettlement && !isSettled && Number.isFinite(Number(displayedSuccessChance)) ? (
                  <span
                    className="shrink-0 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100"
                    data-tooltip-id="success-chance-tooltip"
                    aria-label={successChanceLabel}
                  >
                    Win chance {Math.round(Number(displayedSuccessChance))}%
                  </span>
                ) : null}
                {courtroomDeadlineLabel ? (
                  <span className="shrink-0 rounded-lg border border-amber-200/25 bg-amber-200/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                    {courtroomDeadlineLabel}
                  </span>
                ) : null}
                {isInterview || isCourtroom ? (
                  <button
                    type="button"
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-300/22 bg-rose-500/10 px-3 text-xs font-semibold text-rose-100 transition hover:border-rose-200/45 hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={handleExitCase}
                    disabled={working || awaitingSettlementResponse}
                  >
                    <HeroIcons.XMarkIcon className="h-4 w-4" aria-hidden="true" />
                    {pendingAction === "exit"
                      ? apiConfig.exitPendingLabel || "Exiting..."
                      : apiConfig.exitLabel || "Exit Case"}
                  </button>
                ) : null}
                <ButtonAccount />
              </div>
            </div>

            {!isSettlement && !isSettled ? (
              <div className="mt-4 grid grid-cols-3 border-y border-white/10 text-xs font-semibold text-white/62">
                <a
                  href="#case-brief-desktop"
                  className="flex items-center justify-center gap-1.5 py-3 transition hover:text-white"
                >
                  <HeroIcons.DocumentTextIcon className="h-4 w-4" aria-hidden="true" />
                  Brief
                </a>
                <a
                  href="#fact-sheet-details"
                  className="flex items-center justify-center gap-1.5 py-3 transition hover:text-white"
                >
                  <HeroIcons.ClipboardDocumentListIcon className="h-4 w-4" aria-hidden="true" />
                  Fact Sheet
                </a>
                <a
                  href="#desktop-lawbook-details"
                  className="flex items-center justify-center gap-1.5 py-3 transition hover:text-white"
                >
                  <HeroIcons.BookOpenIcon className="h-4 w-4" aria-hidden="true" />
                  Lawbook
                </a>
              </div>
            ) : null}

            {isSettlement || isSettled ? (
              <div className="mt-3">
                <button
                  type="button"
                  className="rounded-lg border border-amber-200/10 bg-amber-200/[0.035] px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:border-amber-200/18 hover:bg-amber-200/[0.055]"
                  onClick={() => setShowSettlementMatterSummary((current) => !current)}
                >
                  {showSettlementMatterSummary ? "Hide matter summary" : "View matter summary"}
                </button>
                {showSettlementMatterSummary ? (
                  <div className="mt-3 grid gap-3 text-sm text-white/62 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.5fr)]">
                    <div className="rounded-2xl border border-amber-200/8 bg-white/[0.018] p-4">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                        Matter
                      </p>
                      <p className="mt-2 line-clamp-3 leading-6 text-white/72">
                        {heroNarrativeExcerpt}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-sky-300/12 bg-sky-300/[0.045] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">
                          You represent
                        </p>
                        <p className="mt-1 truncate font-semibold text-white">{playerPartyName}</p>
                        <p className="mt-1 text-xs text-white/45">{playerRoleLabel}</p>
                      </div>
                      <div className="rounded-xl border border-rose-300/12 bg-rose-300/[0.045] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-200">
                          Opponent
                        </p>
                        <p className="mt-1 truncate font-semibold text-white">{opponentPartyName}</p>
                        <p className="mt-1 text-xs text-white/45">{opponentRoleLabel}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : !isInterview ? (
              <div className="mt-4 grid gap-3 text-sm text-white/62 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.5fr)]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/42">
                    Matter
                  </p>
                  <p className="mt-2 line-clamp-2 leading-6 text-white/72">
                    {heroNarrativeExcerpt}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-sky-300/20 bg-sky-300/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">
                      You represent
                    </p>
                    <p className="mt-1 truncate font-semibold text-white">{playerPartyName}</p>
                    <p className="mt-1 text-xs text-white/45">{playerRoleLabel}</p>
                  </div>
                  <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-200">
                      Opponent represents
                    </p>
                    <p className="mt-1 truncate font-semibold text-white">{opponentPartyName}</p>
                    <p className="mt-1 text-xs text-white/45">{opponentRoleLabel}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

            <div
              className={`grid min-w-0 gap-6 ${
                isSettlement || isSettled
                  ? "mx-auto w-full max-w-[1600px]"
                  : "xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]"
              }`}
            >
          <section className="min-w-0 space-y-6">
            {isInterview ? (
              <>
              <div className="space-y-4 pb-24 sm:hidden">
                {renderSettlementIntentNoticePanel()}
                {renderSettlementWalkoutNoticePanel()}
                <section className="arena-surface border-amber-200/20 bg-amber-200/[0.045]">
                  <form className="p-4" onSubmit={handleInterviewSubmit}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                          Ask a question
                        </p>
                        <p className="mt-1 text-xs font-semibold text-white/48">
                          {mobileInterviewExchangePairs.length
                            ? `${mobileInterviewExchangePairs.length} exchange${
                                mobileInterviewExchangePairs.length === 1 ? "" : "s"
                              } so far`
                            : `Start with ${playerInterviewSubjectName}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/10 text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-200/15"
                          onClick={requestIntakeTour}
                          aria-label="Take the intake tour"
                          title="Intake tour"
                        >
                          <HeroIcons.QuestionMarkCircleIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="rounded-full border border-white/10 bg-black/24 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/48">
                          {question.trim().length}/500
                        </span>
                      </div>
                    </div>

                    <div
                      className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                      data-intake-tour-target="intake-latest-exchange"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/42">
                            Latest exchange
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {mobileInterviewExchangePairs.length
                              ? `${mobileInterviewExchangePairs.length} total`
                              : "No questions yet"}
                          </p>
                        </div>
                        {mobileInterviewExchangeHistory.length > 0 ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/68 transition hover:border-white/20 hover:text-white"
                            onClick={() =>
                              setShowMobileExchangeHistory((current) => !current)
                            }
                            aria-expanded={showMobileExchangeHistory}
                          >
                            History
                            <HeroIcons.ChevronDownIcon
                              className={`h-3.5 w-3.5 transition ${
                                showMobileExchangeHistory ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        ) : null}
                      </div>

                      {showMobileExchangeHistory && mobileInterviewExchangeHistory.length > 0 ? (
                        <div className="mt-3 border-b border-white/10 pb-3">
                          <div
                            className="arena-scroll space-y-4 overflow-y-auto pr-1"
                            style={{ height: `${interviewHistoryHeight}px` }}
                          >
                            {mobileInterviewExchangeHistory.map((exchange) => (
                              <article
                                key={exchange.id}
                                className="space-y-2"
                              >
                                <div className="flex justify-end">
                                  <div className="max-w-[88%] rounded-2xl rounded-br-md border border-white/[0.06] bg-sky-300/[0.075] px-3 py-2 text-right">
                                    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-sky-200/72">
                                      You
                                    </p>
                                    <p className="mt-1 break-words text-xs font-semibold leading-5 text-white/84">
                                      {exchange.question.text}
                                    </p>
                                  </div>
                                </div>
                                {exchange.response ? (
                                  <div className="flex justify-start">
                                    <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-white/[0.055] bg-amber-200/[0.055] px-3 py-2">
                                      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-amber-200/72">
                                        {getInterviewEntrySpeaker(exchange.response)}
                                      </p>
                                      <p className="mt-1 break-words text-xs font-semibold leading-5 text-white/72">
                                        {exchange.response.text}
                                      </p>
                                    </div>
                                  </div>
                                ) : null}
                              </article>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="mt-2 flex h-5 w-full cursor-ns-resize touch-none items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.035] text-white/35 transition hover:border-white/15 hover:text-white/60"
                            aria-label="Resize interview history"
                            onPointerDown={handleInterviewHistoryResizeStart}
                            onKeyDown={(event) => {
                              if (event.key === "ArrowUp") {
                                event.preventDefault();
                                resizeInterviewHistoryBy(-24);
                              }
                              if (event.key === "ArrowDown") {
                                event.preventDefault();
                                resizeInterviewHistoryBy(24);
                              }
                            }}
                          >
                            <HeroIcons.ArrowsUpDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}

                      {latestMobileInterviewExchange ? (
                        <div className="mt-3 space-y-2">
                          <div className="rounded-xl border border-white/10 bg-black/24 p-3">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-white/44">
                              You
                            </p>
                            <p className="mt-1 break-words text-sm font-semibold leading-5 text-white/88">
                              {latestMobileInterviewExchange.question.text}
                            </p>
                          </div>
                          <div className="rounded-xl border border-amber-200/15 bg-amber-200/8 p-3">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-amber-200/78">
                              {latestMobileInterviewExchange.response
                                ? getInterviewEntrySpeaker(latestMobileInterviewExchange.response)
                                : playerInterviewSubjectName}
                            </p>
                            {latestMobileInterviewExchange.response ? (
                              <p className="mt-1 break-words text-sm font-semibold leading-5 text-white/88">
                                {latestMobileInterviewExchange.response.text}
                              </p>
                            ) : (
                              <div className="mt-1">
                                <p className="text-sm font-semibold leading-5 text-white/72">
                                  {pendingSpeaker || playerInterviewSubjectName} is answering...
                                </p>
                                <TypingIndicator
                                  speaker={pendingSpeaker || playerInterviewSubjectName}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="text-sm font-semibold leading-5 text-white/78">
                            Ask your first question to start building the record.
                          </p>
                        </div>
                      )}
                    </div>

                    <div
                      className="relative mt-3 rounded-2xl border border-amber-200/20 bg-amber-200/[0.035] p-2"
                      data-intake-tour-target="intake-question-box"
                    >
                      <label className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                        <HeroIcons.ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" />
                        Your question
                      </label>
                      <textarea
                        className="textarea textarea-bordered arena-textarea arena-field h-24 min-w-0 w-full pr-12 text-slate-100"
                        placeholder={
                          settlementAuthorityReady
                            ? "Settlement authority is ready. Send settlement intent before asking more questions."
                            : awaitingSettlementResponse
                            ? "Awaiting opposing counsel's settlement response..."
                            : `Type your question to ${playerInterviewSubjectName}...`
                        }
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={handleChatTextareaKeyDown}
                        disabled={transcribingQuestion || awaitingSettlementResponse || settlementAuthorityReady}
                      />
                      <button
                        type="button"
                        className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border ${
                          recordingQuestion
                            ? "border-rose-300/35 bg-rose-400/15 text-rose-100"
                            : "border-white/10 bg-black/24 text-white/58"
                        }`}
                        disabled={working || transcribingQuestion || awaitingSettlementResponse || settlementAuthorityReady}
                        onClick={handleQuestionVoiceInput}
                        aria-label={recordingQuestion ? "Stop recording" : "Record question"}
                      >
                        {transcribingQuestion ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <HeroIcons.MicrophoneIcon className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <button
                      type={settlementAuthorityReady ? "button" : "submit"}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={settlementAuthorityReady ? handleSendSettlementIntent : undefined}
                      disabled={
                        working ||
                        awaitingSettlementResponse ||
                        recordingQuestion ||
                        transcribingQuestion ||
                        (!settlementAuthorityReady && !question.trim())
                      }
                      data-intake-tour-target="intake-send-button"
                      >
                      {settlementAuthorityReady
                        ? "Send Settlement Intent First"
                        : awaitingSettlementResponse
                        ? "Awaiting Response"
                        : pendingAction === "interview"
                        ? "Sending..."
                        : "Send Question"}
                      <HeroIcons.PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {suggestedQuestions.length > 0 ? (
                      <div
                        className="mt-3 flex gap-2 overflow-x-auto pb-1"
                        data-intake-tour-target="intake-suggestions"
                      >
                        {suggestedQuestions.slice(0, 3).map((item) => (
                          <button
                            key={item}
                            type="button"
                            className="shrink-0 rounded-full border border-white/10 bg-black/24 px-3 py-2 text-xs font-semibold text-white/74"
                            onClick={() => setQuestion(item)}
                            disabled={awaitingSettlementResponse || settlementAuthorityReady}
                          >
                            + {item}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </form>
                </section>

                <section id="case-brief" className="arena-surface overflow-hidden">
                  <div className="relative min-h-[14.5rem] p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(251,191,36,0.16),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.72))]" />
                    <div className="absolute right-3 top-4 h-36 w-32 overflow-hidden rounded-2xl border border-white/10 bg-black/28 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
                      {caseSession.clientPortrait?.image ? (
                        <img
                          src={caseSession.clientPortrait.image}
                          alt={`${playerInterviewSubjectName} portrait`}
                          width={640}
                          height={720}
                          className="h-full w-full rounded-[inherit] object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/42">
                          <HeroIcons.UserCircleIcon className="h-10 w-10" aria-hidden="true" />
                          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.08em]">
                            Portrait
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="relative z-10">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                        Interview your client
                      </p>
                      <h2 className="mt-3 max-w-[11.5rem] text-xl font-semibold leading-tight text-white">
                        {playerInterviewSubjectName} is waiting.
                      </h2>
                      <p className="mt-3 max-w-[11.5rem] text-sm leading-6 text-white/64">
                        You represent {playerPartyName}. Ask the right questions to uncover facts and build your case.
                      </p>
                      <button
                        type="button"
                        className="mt-5 w-full rounded-2xl border border-white/10 bg-black/36 p-3 text-left backdrop-blur transition hover:border-white/20"
                        onClick={() => setShowFullMobileBrief((current) => !current)}
                        aria-expanded={showFullMobileBrief}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
                            <HeroIcons.BuildingOffice2Icon className="h-6 w-6" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-sm font-semibold text-white">
                              {playerPartyName}
                            </p>
                            <p
                              className={`mt-1 text-xs leading-5 text-white/58 ${
                                showFullMobileBrief ? "" : "line-clamp-2"
                              }`}
                            >
                              {heroNarrativeExcerpt}
                            </p>
                          </div>
                          <HeroIcons.ChevronDownIcon
                            className={`h-4 w-4 shrink-0 text-white/42 transition ${
                              showFullMobileBrief ? "rotate-180" : ""
                            }`}
                            aria-hidden="true"
                          />
                        </div>
                      </button>
                    </div>
                  </div>
                </section>

                <section id="fact-sheet" className="arena-surface">
                  <div className="p-4">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                        Case file progress
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {completedFactSheetItems} / {factSheetCompletionItems.length} sections discovered
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-1.5">
                      {factSheetSections.map((section) => renderMobileFactSheetButton(section))}
                    </div>
                    <div className="mt-4 arena-progress-track">
                      <div
                        className="arena-progress-fill"
                        style={{ width: `${roundedFactSheetProgressPercent}%` }}
                      />
                    </div>
                    <div className="mt-4 rounded-2xl border border-amber-200/15 bg-amber-200/[0.055] p-3">
                      <p className="text-sm font-semibold leading-6 text-white">
                        Cross-check your fact sheet before court.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/55">
                        Tap each section to review the points your client has given you. Once the
                        file looks right, finalize it to take the case to court.
                      </p>
                      {isIntakeLocked || awaitingSettlementResponse || settlementAuthorityReady ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/18 p-3 text-xs leading-5 text-white/60">
                          {settlementAuthorityReady
                            ? "Your client has given settlement authority. Send settlement intent before continuing intake."
                            : awaitingSettlementResponse
                            ? "Settlement intent has been sent. Waiting for opposing counsel to respond."
                            : apiConfig.intakeLockedMessage ||
                              "Your fact sheet is finalized. Waiting for the other side."}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleFactSheetPrimaryAction}
                        disabled={factSheetPrimaryActionDisabled}
                      >
                        {settlementAuthorityReady
                          ? "Send Settlement Intent First"
                          : awaitingSettlementResponse
                          ? "Awaiting Response"
                          : isIntakeLocked
                          ? "Waiting for Opponent"
                          : pendingAction === "finalize"
                          ? "Finalizing Fact Sheet..."
                          : "Finalize Fact Sheet"}
                        <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {renderSettleButton(
                        "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/25 bg-emerald-200/[0.08] px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:border-emerald-200/50 hover:bg-emerald-200/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
                      )}
                      {pendingAction === "finalize" ? (
                        <div className="mt-3">
                          <LoadingBar label="Finalizing fact sheet" />
                        </div>
                      ) : null}
                      {finalizeFeedback?.text ? (
                        <p
                          className={`mt-3 text-xs leading-5 ${
                            finalizeFeedback.tone === "error"
                              ? "text-rose-200"
                              : "text-emerald-200"
                          }`}
                        >
                          {finalizeFeedback.text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>

                {renderLawbookPanel("sm:hidden", "mobile-lawbook-details")}

                <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/92 px-3 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-[0_-18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
                    {[
                      { href: "#case-brief", label: "Interview", icon: HeroIcons.ChatBubbleLeftRightIcon, active: true },
                      { href: "#fact-sheet", label: "Case File", icon: HeroIcons.DocumentTextIcon, active: false },
                      { href: "#mobile-lawbook-details", label: "Rules", icon: HeroIcons.ScaleIcon, active: false },
                      { href: "#courtroom", label: "Courtroom", icon: HeroIcons.ScaleIcon, active: false },
                    ].map((item) => {
                      const Icon = item.icon;

                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.64rem] font-semibold ${
                            item.active
                              ? "border border-amber-200/30 bg-amber-200/10 text-amber-200"
                              : "text-white/58"
                          }`}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </a>
                      );
                    })}
                  </div>
                </nav>
              </div>

              <div className="hidden space-y-4 sm:block">
                {renderSettlementIntentNoticePanel()}
                {renderSettlementWalkoutNoticePanel()}
                <section className="arena-surface border-white/10 bg-white/[0.025]">
                  <form className="p-4 sm:p-6" onSubmit={handleInterviewSubmit}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                          Ask a question
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">
                          Interview {playerInterviewSubjectName}
                        </h2>
                        <p className="mt-1 text-sm font-semibold text-white/48">
                          {mobileInterviewExchangePairs.length
                            ? `${mobileInterviewExchangePairs.length} exchange${
                                mobileInterviewExchangePairs.length === 1 ? "" : "s"
                              } so far`
                            : "Start building the record."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/10 text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-200/15"
                          onClick={requestIntakeTour}
                          aria-label="Take the intake tour"
                          title="Intake tour"
                        >
                          <HeroIcons.QuestionMarkCircleIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <span className="rounded-full border border-white/10 bg-black/24 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/48">
                          {question.trim().length}/500
                        </span>
                      </div>
                    </div>

                    <div
                      className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4"
                      data-intake-tour-target="intake-latest-exchange"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/42">
                            Latest exchange
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {mobileInterviewExchangePairs.length
                              ? `${mobileInterviewExchangePairs.length} total`
                              : "No questions yet"}
                          </p>
                        </div>
                        {mobileInterviewExchangeHistory.length > 0 ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/68 transition hover:border-white/20 hover:text-white"
                            onClick={() =>
                              setShowMobileExchangeHistory((current) => !current)
                            }
                            aria-expanded={showMobileExchangeHistory}
                          >
                            History
                            <HeroIcons.ChevronDownIcon
                              className={`h-3.5 w-3.5 transition ${
                                showMobileExchangeHistory ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        ) : null}
                      </div>

                      {showMobileExchangeHistory && mobileInterviewExchangeHistory.length > 0 ? (
                        <div className="mt-3 border-b border-white/10 pb-3">
                          <div
                            className="arena-scroll space-y-4 overflow-y-auto pr-1"
                            style={{ height: `${interviewHistoryHeight}px` }}
                          >
                            {mobileInterviewExchangeHistory.map((exchange) => (
                              <article
                                key={exchange.id}
                                className="space-y-2"
                              >
                                <div className="flex justify-end">
                                  <div className="max-w-[74%] rounded-2xl rounded-br-md border border-white/[0.06] bg-sky-300/[0.075] px-4 py-3 text-right">
                                    <p className="text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-sky-200/72">
                                      You
                                    </p>
                                    <p className="mt-1 break-words text-sm font-semibold leading-6 text-white/84">
                                      {exchange.question.text}
                                    </p>
                                  </div>
                                </div>
                                {exchange.response ? (
                                  <div className="flex justify-start">
                                    <div className="max-w-[74%] rounded-2xl rounded-bl-md border border-white/[0.055] bg-amber-200/[0.055] px-4 py-3">
                                      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-amber-200/72">
                                        {getInterviewEntrySpeaker(exchange.response)}
                                      </p>
                                      <p className="mt-1 break-words text-sm font-semibold leading-6 text-white/72">
                                        {exchange.response.text}
                                      </p>
                                    </div>
                                  </div>
                                ) : null}
                              </article>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="mt-2 flex h-5 w-full cursor-ns-resize touch-none items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.035] text-white/35 transition hover:border-white/15 hover:text-white/60"
                            aria-label="Resize interview history"
                            onPointerDown={handleInterviewHistoryResizeStart}
                            onKeyDown={(event) => {
                              if (event.key === "ArrowUp") {
                                event.preventDefault();
                                resizeInterviewHistoryBy(-24);
                              }
                              if (event.key === "ArrowDown") {
                                event.preventDefault();
                                resizeInterviewHistoryBy(24);
                              }
                            }}
                          >
                            <HeroIcons.ArrowsUpDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}

                      {latestMobileInterviewExchange ? (
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-xl border border-white/10 bg-black/24 p-3">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-white/44">
                              You
                            </p>
                            <p className="mt-1 break-words text-sm font-semibold leading-5 text-white/88">
                              {latestMobileInterviewExchange.question.text}
                            </p>
                          </div>
                          <div className="rounded-xl border border-amber-200/15 bg-amber-200/8 p-3">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-amber-200/78">
                              {latestMobileInterviewExchange.response
                                ? getInterviewEntrySpeaker(latestMobileInterviewExchange.response)
                                : playerInterviewSubjectName}
                            </p>
                            {latestMobileInterviewExchange.response ? (
                              <p className="mt-1 break-words text-sm font-semibold leading-5 text-white/88">
                                {latestMobileInterviewExchange.response.text}
                              </p>
                            ) : (
                              <div className="mt-1">
                                <p className="text-sm font-semibold leading-5 text-white/72">
                                  {pendingSpeaker || playerInterviewSubjectName} is answering...
                                </p>
                                <TypingIndicator
                                  speaker={pendingSpeaker || playerInterviewSubjectName}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                          <p className="text-sm font-semibold leading-5 text-white/78">
                            Ask your first question to start building the record.
                          </p>
                        </div>
                      )}

                      {latestEvidenceProductionQuestions.length > 0 ? (
                        <div className="mt-3 rounded-xl border border-amber-200/18 bg-amber-200/[0.055] p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                            Turn evidence into proof
                          </p>
                          <p className="mt-1 text-xs leading-5 text-white/58">
                            Ask them to read, quote, or describe the record so it can help in court.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {latestEvidenceProductionQuestions.slice(0, 2).map((item) => (
                              <button
                                key={`latest-evidence-${item}`}
                                type="button"
                                className="rounded-full border border-amber-200/20 bg-black/18 px-3 py-1.5 text-left text-xs font-semibold text-amber-100 transition hover:border-amber-200/45 hover:bg-amber-200/10"
                                onClick={() => applySuggestedIntakeQuestion(item)}
                                disabled={awaitingSettlementResponse || settlementAuthorityReady}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div
                      className="relative mt-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.035] p-2"
                      data-intake-tour-target="intake-question-box"
                    >
                      <label className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                        <HeroIcons.ChatBubbleLeftRightIcon className="h-4 w-4" aria-hidden="true" />
                        Your question
                      </label>
                      <textarea
                        className="textarea textarea-bordered arena-textarea arena-field h-24 min-w-0 w-full pr-12 text-slate-100"
                        placeholder={
                          settlementAuthorityReady
                            ? "Settlement authority is ready. Send settlement intent before asking more questions."
                            : awaitingSettlementResponse
                            ? "Awaiting opposing counsel's settlement response..."
                            : `Type your question to ${playerInterviewSubjectName}...`
                        }
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={handleChatTextareaKeyDown}
                        disabled={transcribingQuestion || awaitingSettlementResponse || settlementAuthorityReady}
                      />
                      <button
                        type="button"
                        className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border ${
                          recordingQuestion
                            ? "border-rose-300/35 bg-rose-400/15 text-rose-100"
                            : "border-white/10 bg-black/24 text-white/58"
                        }`}
                        disabled={working || transcribingQuestion || awaitingSettlementResponse || settlementAuthorityReady}
                        onClick={handleQuestionVoiceInput}
                        data-tooltip-id="tooltip"
                        data-tooltip-content={
                          recordingQuestion
                            ? "Stop recording and transcribe"
                            : "Record a question with your microphone"
                        }
                        aria-label={
                          recordingQuestion
                            ? "Stop recording and transcribe"
                            : "Record a question with your microphone"
                        }
                      >
                        {transcribingQuestion ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <HeroIcons.MicrophoneIcon className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                      <button
                        type={settlementAuthorityReady ? "button" : "submit"}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 lg:w-56"
                        onClick={settlementAuthorityReady ? handleSendSettlementIntent : undefined}
                        disabled={
                          working ||
                          awaitingSettlementResponse ||
                          recordingQuestion ||
                          transcribingQuestion ||
                          (!settlementAuthorityReady && !question.trim())
                        }
                        data-intake-tour-target="intake-send-button"
                      >
                        {settlementAuthorityReady
                          ? "Send Settlement Intent First"
                          : awaitingSettlementResponse
                          ? "Awaiting Response"
                          : pendingAction === "interview"
                          ? "Sending..."
                          : "Send Question"}
                        <HeroIcons.PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {suggestedQuestions.length > 0 ? (
                        <div
                          className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0"
                          data-intake-tour-target="intake-suggestions"
                        >
                          {suggestedQuestions.slice(0, 4).map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="shrink-0 rounded-full border border-white/10 bg-black/24 px-3 py-2 text-xs font-semibold text-white/74"
                              onClick={() => setQuestion(item)}
                              disabled={awaitingSettlementResponse || settlementAuthorityReady}
                            >
                              + {item}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </form>
                </section>

                <section className="arena-surface-soft flex items-start gap-3 p-4 text-sm text-white/62">
                  <HeroIcons.LightBulbIcon
                    className="h-5 w-5 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                  <p>
                    <span className="font-semibold text-amber-200">Tip:</span> Ask clear,
                    open-ended questions about dates, records, witnesses, notice, and proof gaps.
                  </p>
                </section>
              </div>
              </>
            ) : isSettlement || isSettled ? (
              renderSettlementPanel()
            ) : isExited ? (
              <div className="arena-surface">
                <div className="p-4 sm:p-6">
                  <p className="arena-kicker text-rose-300">Case Exited</p>
                  <h2 className="arena-headline mt-2 text-2xl">This intake was closed</h2>
                  <p className="mt-3 max-w-2xl text-white/66">
                    You exited this generated matter during intake. You can return to the
                    dashboard and generate a fresh case immediately.
                  </p>
                  <div className="mt-5">
                    <Link href="/dashboard" className="arena-btn-light inline-flex px-5 py-3">
                      Back to Cases
                    </Link>
                  </div>
                          </div>
                        </div>
                      ) : (
              <>
              <div id="courtroom" className="space-y-4 pb-24 sm:hidden">
                <section className="arena-surface overflow-hidden border-white/10 bg-white/[0.025]">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-sky-300">
                          You represent: <span className="text-white/72">{playerPartyName}</span>
                          <span className="ml-1 text-white/38">({playerRoleLabel})</span>
                        </p>
                        <p className="mt-2 text-sm font-semibold text-rose-300">
                          Opponent represents: <span className="text-white/72">{opponentPartyName}</span>
                          <span className="ml-1 text-white/38">({opponentRoleLabel})</span>
                        </p>
                      </div>
                      {!isSettlement && !isSettled && Number.isFinite(Number(displayedSuccessChance)) ? (
                        <span
                          className="shrink-0 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-semibold text-emerald-100"
                          data-tooltip-id="success-chance-tooltip"
                          aria-label={successChanceLabel}
                        >
                          Win Chance {Math.round(Number(displayedSuccessChance))}%
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.035] px-3 py-2 text-sm font-semibold text-white">
                        <HeroIcons.ScaleIcon className="h-5 w-5 text-white/62" aria-hidden="true" />
                        Round {displayedCourtroomRound} of {caseSession.maxCourtRounds}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="arena-surface border-white/10 bg-white/[0.025]">
                  <div className="space-y-4 p-4">
                    <div className="flex items-center gap-3">
                      <CourtPortraitAvatar
                        src={opponentCourtPortrait}
                        alt={`${opponentCounselLabel} lawyer portrait`}
                        className="border border-rose-300/30 bg-rose-400/12 text-rose-100"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-lg font-semibold text-white">{opponentPartyName}</p>
                          <p className="text-2xl font-bold text-rose-300">{Math.round(opponentPressurePct)}%</p>
                        </div>
                        {showPvpCounselNames ? (
                          <p className="mt-1 truncate text-sm font-semibold text-rose-100/70">
                            Represented by {opponentCounselLabel}
                          </p>
                        ) : null}
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/12">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300"
                            style={{ width: `${opponentPressurePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-white/8 pt-4">
                      <div className="flex items-center gap-3">
                        <CourtPortraitAvatar
                          src={playerCourtPortrait}
                          alt="Your lawyer portrait"
                          className="border border-sky-300/30 bg-sky-400/12 text-sky-100"
                          fallbackIcon={HeroIcons.ShieldCheckIcon}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-lg font-semibold text-white">{playerPartyName}</p>
                            <p className="text-2xl font-bold text-sky-300">{Math.round(playerPressurePct)}%</p>
                          </div>
                          {showPvpCounselNames ? (
                            <p className="mt-1 truncate text-sm font-semibold text-sky-100/70">
                              Represented by you
                            </p>
                          ) : null}
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/12">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300"
                              style={{ width: `${playerPressurePct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="text-center text-sm text-white/50">
                      More persuasive arguments increase your lead.
                    </p>
                  </div>
                </section>

                <section className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.055] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/12 text-amber-100">
                      <HeroIcons.AcademicCapIcon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-amber-100">Judge Signal</h2>
                        <InfoDot
                          content="The bench signal summarizes what the judge appears to value this round."
                          label="Explain judge signal"
                        />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/76">
                        {caseSession.score.lastBenchSignal ||
                          "The judge is listening. Facts and law will move the bench."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-white/12 pt-4">
                    <p className="text-sm font-semibold text-amber-200">Focus this round:</p>
                    <ul className="mt-2 space-y-2 text-sm leading-5 text-white/72">
                      {(courtroomFocusItems.length
                        ? courtroomFocusItems
                        : ["Use your strongest fact", "Challenge weak proof", "Cite the lawbook"]
                      ).map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                          <span className="min-w-0 flex-1">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                {lastOpponentCourtEntry ? (
                  <section className="rounded-2xl border border-rose-400/35 bg-rose-950/18 p-4">
                    <div className="flex items-start gap-3">
                      <CourtPortraitAvatar
                        src={opponentCourtPortrait}
                        alt={`${opponentCounselLabel} lawyer portrait`}
                        className="h-11 w-11 border border-rose-300/30 bg-rose-400/12 text-rose-100"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{opponentPartyName}</h3>
                          <span className="rounded-lg border border-rose-300/25 bg-rose-400/10 px-2 py-1 text-xs font-semibold text-rose-200">
                            Opponent Argument
                          </span>
                          <span className="text-xs font-semibold text-white/42">
                            Round {lastOpponentCourtEntryDisplayRound}
                          </span>
                        </div>
                        <p
                          className={`mt-3 whitespace-pre-wrap text-sm leading-6 text-white/78 ${
                            showFullMobileOpponentArgument ? "" : "line-clamp-4"
                          }`}
                        >
                          {lastOpponentCourtEntry.text}
                        </p>
                        {mobileOpponentArgumentCanExpand ? (
                          <button
                            type="button"
                            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-200 transition hover:text-rose-100"
                            onClick={() =>
                              setShowFullMobileOpponentArgument((current) => !current)
                            }
                            aria-expanded={showFullMobileOpponentArgument}
                          >
                            {showFullMobileOpponentArgument
                              ? "Show less"
                              : "Show full argument"}
                            <HeroIcons.ChevronDownIcon
                              className={`h-4 w-4 transition ${
                                showFullMobileOpponentArgument ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </section>
                ) : null}

                {showSubmittedPlayerCourtEntry ? (
                  <section className="rounded-2xl border border-sky-300/35 bg-sky-500/[0.07] p-4">
                    <div className="flex items-start gap-3">
                      <CourtPortraitAvatar
                        src={playerCourtPortrait}
                        alt="Your lawyer portrait"
                        className="h-11 w-11 border border-sky-300/35 bg-sky-400/12 text-sky-100"
                        fallbackIcon={HeroIcons.ShieldCheckIcon}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">You</h3>
                          <span className="rounded-lg border border-sky-300/25 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-200">
                            Your Argument
                          </span>
                          <span className="text-xs font-semibold text-white/42">
                            Round {lastPlayerCourtEntryDisplayRound}
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/78">
                          {lastPlayerCourtEntry.text}
                        </p>
                      </div>
                    </div>
                  </section>
                ) : null}

                {showCourtroomWaitingCard ? (
                  <section className="arena-surface p-4">
                    <p className="font-semibold text-white">{courtroomWaitingMessage}</p>
                    <TypingIndicator speaker={opponentPartyName} />
                    <div className="mt-4">
                      <LoadingBar label={`${opponentPartyName} is preparing a response`} />
                    </div>
                  </section>
                ) : null}

                {!isVerdict && !showCourtroomWaitingCard ? (
                  <section className="rounded-2xl border border-sky-300/30 bg-sky-500/[0.055] p-4">
                    <form className="min-w-0 space-y-4" onSubmit={handleCourtroomSubmit}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <CourtPortraitAvatar
                              src={playerCourtPortrait}
                              alt="Your lawyer portrait"
                              className="h-11 w-11 border border-sky-300/35 bg-sky-400/12 text-sky-100"
                              fallbackIcon={HeroIcons.ShieldCheckIcon}
                            />
                            <div>
                              <h2 className="text-xl font-semibold text-sky-200">Your Move</h2>
                              <p className="mt-1 text-sm leading-5 text-white/68">
                                Defend {playerPartyName}. Use facts, expose weaknesses, and cite the law.
                              </p>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-xl border border-sky-300/25 bg-black/16 px-3 py-2 text-xs font-semibold text-sky-100"
                          onClick={() => openMobileFactSheetDialog(activeMobileFactSheetKey)}
                        >
                          Fact Sheet
                        </button>
                      </div>
                      <div className="relative">
                        <textarea
                          className="textarea textarea-bordered arena-textarea arena-field h-32 min-w-0 w-full text-slate-100"
                          placeholder="Your argument to the judge..."
                          value={argument}
                          onChange={(event) => setArgument(event.target.value)}
                          onKeyDown={handleChatTextareaKeyDown}
                          disabled={transcribingArgument || courtroomTimeoutPending}
                        />
                        <span className="absolute bottom-3 right-3 text-xs font-semibold text-white/45">
                          {argument.trim().length} / 2500
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`w-full justify-center rounded-xl border px-4 py-3 text-sm font-semibold ${
                          recordingArgument
                            ? "border-rose-300/35 bg-rose-400/15 text-rose-100"
                            : "border-white/12 bg-white/[0.035] text-white/82"
                        }`}
                        disabled={working || transcribingArgument || courtroomTimeoutPending}
                        onClick={handleArgumentVoiceInput}
                      >
                        {recordingArgument
                          ? "Stop Voice Argument"
                          : transcribingArgument
                          ? "Transcribing"
                          : "Voice Argument"}
                      </button>
                      {courtroomTimeoutPending ? (
                        <p className="rounded-xl border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-sm font-semibold text-amber-100">
                          Court is preparing a timeout verdict.
                        </p>
                      ) : null}
                      <button
                        className="w-full rounded-xl border border-white/80 bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={working || recordingArgument || transcribingArgument || courtroomTimeoutPending || !argument.trim()}
                      >
                        {pendingAction === "courtroom" ? (
                          <PresentingArgumentIndicator captionClassName="text-blue-800" />
                        ) : (
                          <>
                            Present Argument
                            <span className="mt-1 block text-xs font-medium text-blue-800">
                              Submit your argument to the judge
                            </span>
                          </>
                        )}
                      </button>
                    </form>
                  </section>
                ) : null}

                <section className="arena-surface-soft flex items-start gap-3 p-4 text-sm text-white/62">
                  <HeroIcons.LightBulbIcon className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                  <p><span className="font-semibold text-amber-200">Tip:</span> Strong arguments are specific, calm, and backed by facts.</p>
                </section>
              </div>

              <div className="hidden space-y-4 sm:block">
                <section className="arena-surface overflow-hidden border-white/10 bg-white/[0.025]">
                  <div className="grid gap-0 lg:grid-cols-2">
                    <div className="space-y-4 p-4 sm:p-6">
                      <div className="flex items-center gap-3">
                        <CourtPortraitAvatar
                          src={opponentCourtPortrait}
                          alt={`${opponentCounselLabel} lawyer portrait`}
                          className="border border-rose-300/30 bg-rose-400/12 text-rose-100"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-lg font-semibold text-white">
                              {opponentPartyName}
                            </p>
                            <p className="text-2xl font-bold text-rose-300">
                              {Math.round(opponentPressurePct)}%
                            </p>
                          </div>
                          {showPvpCounselNames ? (
                            <p className="mt-1 truncate text-sm font-semibold text-rose-100/70">
                              Represented by {opponentCounselLabel}
                            </p>
                          ) : null}
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/12">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300"
                              style={{ width: `${opponentPressurePct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-white/8 pt-4">
                        <div className="flex items-center gap-3">
                          <CourtPortraitAvatar
                            src={playerCourtPortrait}
                            alt="Your lawyer portrait"
                            className="border border-sky-300/30 bg-sky-400/12 text-sky-100"
                            fallbackIcon={HeroIcons.ShieldCheckIcon}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-lg font-semibold text-white">
                                {playerPartyName}
                              </p>
                              <p className="text-2xl font-bold text-sky-300">
                                {Math.round(playerPressurePct)}%
                              </p>
                            </div>
                            {showPvpCounselNames ? (
                              <p className="mt-1 truncate text-sm font-semibold text-sky-100/70">
                                Represented by you
                              </p>
                            ) : null}
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/12">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300"
                                style={{ width: `${playerPressurePct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-center text-sm text-white/50">
                        More persuasive arguments increase your lead.
                      </p>
                    </div>

                    <div className="border-t border-white/10 p-4 sm:p-6 lg:border-l lg:border-t-0">
                      <div className="flex items-start gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/12 text-amber-100">
                          <HeroIcons.AcademicCapIcon className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold text-amber-100">
                              Judge Signal
                            </h2>
                            <InfoDot
                              content="The bench signal summarizes what the judge appears to value this round."
                              label="Explain judge signal"
                            />
                          </div>
                          <p className="mt-2 text-sm leading-6 text-white/76">
                            {caseSession.score.lastBenchSignal ||
                              "The judge is listening. Facts and law will move the bench."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 border-t border-white/12 pt-4">
                        <p className="text-sm font-semibold text-amber-200">
                          Focus this round:
                        </p>
                        <ul className="mt-2 space-y-2 text-sm leading-5 text-white/72">
                          {(courtroomFocusItems.length
                            ? courtroomFocusItems
                            : ["Use your strongest fact", "Challenge weak proof", "Cite the lawbook"]
                          ).map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                              <span className="min-w-0 flex-1">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>

                {lastOpponentCourtEntry ? (
                  <section className="rounded-2xl border border-rose-400/35 bg-rose-950/18 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <CourtPortraitAvatar
                        src={opponentCourtPortrait}
                        alt={`${opponentCounselLabel} lawyer portrait`}
                        className="h-11 w-11 border border-rose-300/30 bg-rose-400/12 text-rose-100"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{opponentPartyName}</h3>
                          <span className="rounded-lg border border-rose-300/25 bg-rose-400/10 px-2 py-1 text-xs font-semibold text-rose-200">
                            Opponent Argument
                          </span>
                          <span className="text-xs font-semibold text-white/42">
                            Round {lastOpponentCourtEntryDisplayRound}
                          </span>
                        </div>
                        <p
                          className={`mt-3 whitespace-pre-wrap text-sm leading-6 text-white/78 ${
                            showFullMobileOpponentArgument ? "" : "line-clamp-4"
                          }`}
                        >
                          {lastOpponentCourtEntry.text}
                        </p>
                        {mobileOpponentArgumentCanExpand ? (
                          <button
                            type="button"
                            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-200 transition hover:text-rose-100"
                            onClick={() =>
                              setShowFullMobileOpponentArgument((current) => !current)
                            }
                            aria-expanded={showFullMobileOpponentArgument}
                          >
                            {showFullMobileOpponentArgument
                              ? "Show less"
                              : "Show full argument"}
                            <HeroIcons.ChevronDownIcon
                              className={`h-4 w-4 transition ${
                                showFullMobileOpponentArgument ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </section>
                ) : null}

                {showSubmittedPlayerCourtEntry ? (
                  <section className="rounded-2xl border border-sky-300/35 bg-sky-500/[0.07] p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <CourtPortraitAvatar
                        src={playerCourtPortrait}
                        alt="Your lawyer portrait"
                        className="h-11 w-11 border border-sky-300/35 bg-sky-400/12 text-sky-100"
                        fallbackIcon={HeroIcons.ShieldCheckIcon}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">You</h3>
                          <span className="rounded-lg border border-sky-300/25 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-200">
                            Your Argument
                          </span>
                          <span className="text-xs font-semibold text-white/42">
                            Round {lastPlayerCourtEntryDisplayRound}
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/78">
                          {lastPlayerCourtEntry.text}
                        </p>
                      </div>
                    </div>
                  </section>
                ) : null}

                {showCourtroomWaitingCard ? (
                  <section className="arena-surface p-4">
                    <p className="font-semibold text-white">{courtroomWaitingMessage}</p>
                    <TypingIndicator speaker={opponentPartyName} />
                    <div className="mt-4">
                      <LoadingBar label={`${opponentPartyName} is preparing a response`} />
                    </div>
                  </section>
                ) : null}

                {!isVerdict && !showCourtroomWaitingCard ? (
                  <section className="rounded-2xl border border-sky-300/30 bg-sky-500/[0.055] p-4 sm:p-5">
                    <form className="min-w-0 space-y-4" onSubmit={handleCourtroomSubmit}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <CourtPortraitAvatar
                              src={playerCourtPortrait}
                              alt="Your lawyer portrait"
                              className="h-11 w-11 border border-sky-300/35 bg-sky-400/12 text-sky-100"
                              fallbackIcon={HeroIcons.ShieldCheckIcon}
                            />
                            <div>
                              <h2 className="text-xl font-semibold text-sky-200">Your Move</h2>
                              <p className="mt-1 text-sm leading-5 text-white/68">
                                Defend {playerPartyName}. Use facts, expose weaknesses, and cite
                                the law.
                              </p>
                            </div>
                          </div>
                        </div>
                        <a
                          href="#fact-sheet-details"
                          className="shrink-0 rounded-xl border border-sky-300/25 bg-black/16 px-3 py-2 text-xs font-semibold text-sky-100"
                        >
                          Fact Sheet
                        </a>
                      </div>
                      <div className="relative">
                        <textarea
                          className="textarea textarea-bordered arena-textarea arena-field h-36 min-w-0 w-full text-slate-100"
                          placeholder="Your argument to the judge..."
                          value={argument}
                          onChange={(event) => setArgument(event.target.value)}
                          onKeyDown={handleChatTextareaKeyDown}
                          disabled={transcribingArgument || courtroomTimeoutPending}
                        />
                        <span className="absolute bottom-3 right-3 text-xs font-semibold text-white/45">
                          {argument.trim().length} / 2500
                        </span>
                      </div>
                      {argumentQuickTools.length ? (
                        <div className="flex flex-wrap gap-2">
                          {argumentQuickTools.map(([label, snippet]) => (
                            <button
                              key={label}
                              type="button"
                              className="rounded-full border border-white/10 bg-black/24 px-3 py-2 text-xs font-semibold text-white/74"
                              onClick={() => appendArgumentSnippet(snippet)}
                            >
                              + {label}
                            </button>
                          ))}
                          {argument.trim() ? (
                            <button
                              type="button"
                              className="rounded-full border border-white/10 bg-black/24 px-3 py-2 text-xs font-semibold text-white/74"
                              onClick={() => setArgument("")}
                            >
                              Clear draft
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)]">
                        <button
                          type="button"
                          className={`w-full justify-center rounded-xl border px-4 py-3 text-sm font-semibold ${
                            recordingArgument
                              ? "border-rose-300/35 bg-rose-400/15 text-rose-100"
                              : "border-white/12 bg-white/[0.035] text-white/82"
                          }`}
                          disabled={working || transcribingArgument || courtroomTimeoutPending}
                          onClick={handleArgumentVoiceInput}
                          data-tooltip-id="tooltip"
                          data-tooltip-content={
                            recordingArgument
                              ? "Stop recording and transcribe"
                              : "Record an argument with your microphone"
                          }
                          aria-label={
                            recordingArgument
                              ? "Stop recording and transcribe"
                              : "Record an argument with your microphone"
                          }
                        >
                          {recordingArgument ? (
                            <span className="inline-flex items-center gap-2">
                              Stop Voice Argument
                              <VoiceWaveform level={argumentAudioLevel} />
                            </span>
                          ) : transcribingArgument ? (
                            "Transcribing"
                          ) : (
                            "Voice Argument"
                          )}
                        </button>
                        <button
                          className="w-full rounded-xl border border-amber-200/35 bg-amber-200 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={working || recordingArgument || transcribingArgument || courtroomTimeoutPending || !argument.trim()}
                        >
                          {pendingAction === "courtroom" ? (
                            <PresentingArgumentIndicator />
                          ) : (
                            <>
                              Present Argument
                              <span className="mt-1 block text-xs font-medium text-black/62">
                                Submit your argument to the judge
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                      {courtroomTimeoutPending ? (
                        <p className="rounded-xl border border-amber-200/25 bg-amber-200/10 px-3 py-2 text-sm font-semibold text-amber-100">
                          Court is preparing a timeout verdict.
                        </p>
                      ) : null}
                    </form>
                  </section>
                ) : null}

                <section className="arena-surface-soft flex items-start gap-3 p-4 text-sm text-white/62">
                  <HeroIcons.LightBulbIcon
                    className="h-5 w-5 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                  <p>
                    <span className="font-semibold text-amber-200">Tip:</span> Strong arguments
                    are specific, calm, and backed by facts.
                  </p>
                </section>
              </div>
              </>
            )}

            {(isInterview || isCourtroom) &&
              renderLawbookPanel("hidden xl:block", "desktop-lawbook-details")}

            {awardChanges.length ? (
              <AwardUnlockPanel
                changes={awardChanges}
                playerId={apiConfig.playerId || caseSession.playerUserId || ""}
              />
            ) : null}

            {isVerdict && (
              <div
                className={`arena-surface overflow-hidden border ${verdictStyle.card}`}
              >
                <div
                  className={`relative bg-gradient-to-b ${verdictGlowClass} to-transparent p-4 sm:p-7`}
                >
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="h-px w-10 bg-white/12" />
                        <p className={`arena-kicker ${verdictStyle.eyebrow}`}>
                          Final Ruling
                        </p>
                        <span className="h-px w-10 bg-white/12" />
                      </div>
                      <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${verdictPillClass}`}>
                        <HeroIcons.ScaleIcon className="h-5 w-5" aria-hidden="true" />
                        {winnerSignal[caseSession.verdict.winner] || winnerSignal.draw}
                      </div>
                    </div>
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-100"
                    >
                      Back to Cases
                      <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>

                  <div className="mt-5 max-w-4xl text-center sm:mx-auto">
                    <h2 className={`font-serif text-4xl font-semibold leading-tight sm:text-5xl ${verdictAccentClass}`}>
                      {winnerLabel[caseSession.verdict.winner]}
                    </h2>
                    <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                      {caseSession.verdict.summary}
                    </p>
                  </div>

                  <div className={`mt-6 flex items-center gap-3 rounded-2xl border px-4 py-3 ${verdictPillClass}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/25 bg-black/20">
                      <HeroIcons.ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 sm:flex sm:items-center sm:gap-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">
                        Key issue
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-white/82 sm:mt-0">
                        {verdictKeyIssue}
                      </p>
                    </div>
                  </div>

                  <section className="mt-5 rounded-2xl border border-amber-200/20 bg-black/22 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <HeroIcons.NewspaperIcon className="h-5 w-5 text-amber-200" aria-hidden="true" />
                          <h3 className="font-serif text-xl font-semibold text-white">Legal Arena case report</h3>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                          Turn this verdict into a public, search-friendly report featuring your advocacy.
                          {analyticsMode === "pvp" ? " Both lawyers must consent before it is published." : ""}
                        </p>
                      </div>
                      {caseReport.status === "published" ? (
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/blog/${caseReport.slug}`} className="rounded-xl bg-amber-200 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-amber-100">Read report</Link>
                          <button type="button" disabled={caseReportWorking} onClick={handleUnpublishCaseReport} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/72 transition hover:border-white/30 hover:text-white disabled:opacity-50">Unpublish</button>
                        </div>
                      ) : caseReport.status === "unpublished" ? (
                        <span className="rounded-full border border-white/12 px-3 py-2 text-xs font-semibold text-white/45">Unpublished permanently</span>
                      ) : (
                        <button type="button" disabled={caseReportWorking || caseReport.status === "generating" || (caseReport.status === "awaiting_consent" && caseReport.viewerConsented)} onClick={() => publishCaseReport()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-200 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60">
                          {caseReportWorking || caseReport.status === "generating" ? <HeroIcons.ArrowPathIcon className="h-4 w-4 animate-spin" /> : <HeroIcons.NewspaperIcon className="h-4 w-4" />}
                          {caseReport.status === "failed" ? "Retry publication" : caseReport.status === "awaiting_consent" && caseReport.viewerConsented ? "Waiting for other lawyer" : "Publish case report"}
                        </button>
                      )}
                    </div>
                    <div className="mt-4 grid gap-3 border-t border-white/8 pt-4 md:grid-cols-2">
                      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                        <span><span className="block text-sm font-semibold text-white/82">Auto-publish future verdicts</span><span className="mt-1 block text-xs leading-5 text-white/45">Off by default. PVP still requires both lawyers.</span></span>
                        <input type="checkbox" className="checkbox checkbox-warning checkbox-sm" checked={caseReportPreferences.autoPublishCaseReports} onChange={(event) => updateCaseReportPreference("autoPublishCaseReports", event.target.checked)} />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                        <span><span className="block text-sm font-semibold text-white/82">Use my lawyer portrait</span><span className="mt-1 block text-xs leading-5 text-white/45">Separate consent for generated report images.</span></span>
                        <input type="checkbox" className="checkbox checkbox-warning checkbox-sm" checked={caseReportPreferences.allowPortraitInCaseReports} onChange={(event) => updateCaseReportPreference("allowPortraitInCaseReports", event.target.checked)} />
                      </label>
                    </div>
                    {getCaseReportProgressLabel(caseReport) ? <p className="mt-3 flex items-center gap-2 text-sm text-amber-100/75">{caseReport.status === "generating" ? <HeroIcons.ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}{getCaseReportProgressLabel(caseReport)}</p> : null}
                    {caseReport.status === "failed" ? <p className="mt-3 text-sm text-rose-200">Generation did not finish. Nothing was published; you can safely retry.</p> : null}
                  </section>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.055] p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/12 text-emerald-100">
                          <HeroIcons.ShieldCheckIcon className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div className="flex items-center gap-2">
                          <p className="font-serif text-xl font-semibold text-white">
                            What helped your side
                          </p>
                          <InfoDot
                            content={helpText.helpedYourSide}
                            label="Explain what helped your side"
                          />
                        </div>
                      </div>
                      <ul className="mt-4 divide-y divide-white/8">
                        {(caseSession.verdict.highlights || []).map((item) => (
                          <li key={item} className="flex gap-3 py-3 text-sm leading-6 text-white/70">
                            <HeroIcons.CheckCircleIcon
                              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"
                              aria-hidden="true"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-rose-300/25 bg-rose-300/[0.055] p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rose-300/30 bg-rose-300/12 text-rose-100">
                          <HeroIcons.BoltSlashIcon className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div className="flex items-center gap-2">
                          <p className="font-serif text-xl font-semibold text-white">
                            What weakened your side
                          </p>
                          <InfoDot
                            content={helpText.weakenedYourSide}
                            label="Explain what weakened your side"
                          />
                        </div>
                      </div>
                      <ul className="mt-4 divide-y divide-white/8">
                        {(caseSession.verdict.concerns || []).map((item) => (
                          <li key={item} className="flex gap-3 py-3 text-sm leading-6 text-white/70">
                            <HeroIcons.XCircleIcon
                              className="mt-0.5 h-5 w-5 shrink-0 text-rose-300"
                              aria-hidden="true"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <details className="group mt-4 rounded-2xl border border-white/10 bg-black/18">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-sm font-semibold text-white/78">
                      <span className="inline-flex items-center gap-2">
                        <HeroIcons.DocumentTextIcon className="h-5 w-5 text-amber-200" aria-hidden="true" />
                        See judge reasoning
                      </span>
                      <CollapseChevron />
                    </summary>
                    <div className="border-t border-white/8 p-4 text-sm leading-7 text-white/62">
                      <p>{caseSession.score.lastBenchSignal || caseSession.verdict.summary}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="flex min-h-[5.25rem] flex-col justify-between rounded-xl border border-sky-300/15 bg-sky-300/[0.045] p-3">
                          <p className="whitespace-nowrap text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-sky-200/70">
                            Your score
                          </p>
                          <p className="text-2xl font-bold leading-none text-sky-100">
                            {caseSession.verdict.finalScore?.player ?? caseSession.score.player}
                          </p>
                        </div>
                        <div className="flex min-h-[5.25rem] flex-col justify-between rounded-xl border border-rose-300/15 bg-rose-300/[0.045] p-3">
                          <p className="whitespace-nowrap text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-rose-200/70">
                            Opponent score
                          </p>
                          <p className="text-2xl font-bold leading-none text-rose-100">
                            {caseSession.verdict.finalScore?.opponent ?? caseSession.score.opponent}
                          </p>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            )}
          </section>

          <aside className="hidden min-w-0 space-y-6 sm:block">
            {isInterview ? (
              <>
                {workspaceNotice}
                <section id="desktop-client-brief" className="arena-surface overflow-hidden">
                  <div className="relative min-h-[17rem] p-6">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(251,191,36,0.14),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.045),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.54))]" />
                    <div className="absolute right-5 top-5 h-36 w-32 overflow-hidden rounded-2xl border border-white/10 bg-black/28 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
                      {caseSession.clientPortrait?.image ? (
                        <img
                          src={caseSession.clientPortrait.image}
                          alt={`${playerInterviewSubjectName} portrait`}
                          width={640}
                          height={720}
                          className="h-full w-full rounded-[inherit] object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/42">
                          <HeroIcons.UserCircleIcon className="h-10 w-10" aria-hidden="true" />
                          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.08em]">
                            Portrait
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="relative z-10 max-w-[13.5rem]">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                        Interview your client
                      </p>
                      <h2 className="mt-3 text-2xl font-semibold leading-tight text-white">
                        {playerInterviewSubjectName} is waiting.
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-white/64">
                        You represent {playerPartyName}. Ask the right questions to uncover facts and build your case.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="relative z-10 mt-5 w-full rounded-2xl border border-white/10 bg-black/36 p-3 text-left backdrop-blur transition hover:border-white/20"
                      onClick={() => setShowFullMobileBrief((current) => !current)}
                      aria-expanded={showFullMobileBrief}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
                          <HeroIcons.BuildingOffice2Icon className="h-6 w-6" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm font-semibold text-white">
                            {playerPartyName}
                          </p>
                          <p
                            className={`mt-1 text-xs leading-5 text-white/58 ${
                              showFullMobileBrief ? "" : "line-clamp-2"
                            }`}
                          >
                            {heroNarrativeExcerpt}
                          </p>
                        </div>
                        <HeroIcons.ChevronDownIcon
                          className={`h-4 w-4 shrink-0 text-white/42 transition ${
                            showFullMobileBrief ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  </div>
                </section>

                <section id="fact-sheet-details" className="arena-surface">
                  <div className="p-4 sm:p-6">
                    <p className="arena-kicker">Case File Progress</p>
                    <p className="mt-3 text-sm font-semibold text-white">
                      {completedFactSheetItems} / {factSheetCompletionItems.length} sections discovered
                    </p>
                    <div className="mt-5 grid grid-cols-4 gap-2">
                      {factSheetSections.map((section) => {
                        const Icon =
                          section.icon ||
                          factSheetSectionIconMap[section.key] ||
                          HeroIcons.DocumentTextIcon;
                        const sectionCount = cleanDraftList(factSheetDraft[section.key]).length;
                        const isComplete = sectionCount > 0;
                        const isSelected = activeMobileFactSheetKey === section.key;

                        return (
                          <button
                            key={`desktop-intake-${section.key}`}
                            type="button"
                            className={`relative flex min-h-[4.85rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 text-center transition ${
                              isSelected
                                ? "border-amber-200/45 bg-amber-300/12 text-amber-100"
                                : isComplete
                                ? "border-emerald-300/25 bg-emerald-300/8 text-emerald-100"
                                : "border-white/10 bg-black/18 text-white/48"
                            } ${getFactSheetProgressButtonClass(section.key)}`}
                            onClick={() => openMobileFactSheetDialog(section.key)}
                            disabled={awaitingSettlementResponse || settlementAuthorityReady}
                          >
                            {renderFactSheetProgressBadge(section.key)}
                            <Icon
                              className={`h-4 w-4 ${
                                isSelected
                                  ? "text-amber-100"
                                  : isComplete
                                  ? "text-emerald-200"
                                  : "text-amber-200"
                              }`}
                              aria-hidden="true"
                            />
                            <span className="line-clamp-1 text-[0.58rem] font-semibold leading-tight">
                              {factSheetSectionCompactLabel[section.key] || section.title}
                            </span>
                            <span className="text-[0.58rem] text-white/42">
                              {sectionCount}/{Math.max(sectionCount, 1)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 arena-progress-track">
                      <div
                        className="arena-progress-fill"
                        style={{ width: `${roundedFactSheetProgressPercent}%` }}
                      />
                    </div>
                    <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.055] p-4">
                      <p className="text-sm font-semibold leading-6 text-white">
                        Cross-check your fact sheet before court.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/55">
                        Tap each section to review the points your client has given you. Once the
                        file looks right, finalize it to take the case to court.
                      </p>
                      {activeMobileFactSheetSection ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/18 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                            {activeMobileFactSheetSection.title}
                          </p>
                          {activeMobileFactSheetItems.length > 0 ? (
                            <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-white/78">
                              {activeMobileFactSheetItems[0]}
                            </p>
                          ) : (
                            <p className="mt-2 text-sm text-white/45">
                              {activeMobileFactSheetSection.empty}
                            </p>
                          )}
                        </div>
                      ) : null}
                      {isIntakeLocked || awaitingSettlementResponse || settlementAuthorityReady ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/18 p-3 text-xs leading-5 text-white/60">
                          {settlementAuthorityReady
                            ? "Your client has given settlement authority. Send settlement intent before continuing intake."
                            : awaitingSettlementResponse
                            ? "Settlement intent has been sent. Waiting for opposing counsel to respond."
                            : apiConfig.intakeLockedMessage ||
                              "Your fact sheet is finalized. Waiting for the other side."}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleFactSheetPrimaryAction}
                        disabled={factSheetPrimaryActionDisabled}
                      >
                        {settlementAuthorityReady
                          ? "Send Settlement Intent First"
                          : awaitingSettlementResponse
                          ? "Awaiting Response"
                          : isIntakeLocked
                          ? "Waiting for Opponent"
                          : pendingAction === "finalize"
                          ? "Finalizing Fact Sheet..."
                          : "Finalize Fact Sheet"}
                        <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {renderSettleButton(
                        "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/25 bg-emerald-200/[0.08] px-5 py-3 text-sm font-semibold text-emerald-50 transition hover:border-emerald-200/50 hover:bg-emerald-200/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
                      )}
                      {pendingAction === "finalize" ? (
                        <div className="mt-3">
                          <LoadingBar label="Finalizing fact sheet" />
                        </div>
                      ) : null}
                      {finalizeFeedback?.text ? (
                        <p
                          className={`mt-3 text-sm leading-6 ${
                            finalizeFeedback.tone === "error"
                              ? "text-rose-200"
                              : "text-emerald-200"
                          }`}
                        >
                          {finalizeFeedback.text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </section>

              </>
            ) : isSettlement || isSettled ? null : (
              <>
            {workspaceNotice}
            <div id="fact-sheet-details" className="arena-surface">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="arena-kicker">Fact Sheet</p>
                    <h2 className="arena-headline mt-2 text-2xl">Case file</h2>
                  </div>
                  <div className="flex flex-row flex-wrap gap-2 sm:flex-col sm:items-end">
                    <span
                      className={`badge border arena-status ${
                        caseSession.factSheet.ready
                          ? "arena-status-favorable"
                          : "arena-status-caution"
                      }`}
                    >
                      {caseSession.factSheet.ready ? "Court-ready" : "Draft"}
                    </span>
                    {!isSettlement && !isSettled && Number.isFinite(Number(displayedSuccessChance)) ? (
                      <span
                        className="badge border border-sky-300/35 bg-sky-300/10 px-3 py-3 text-sky-100"
                        data-tooltip-id="success-chance-tooltip"
                        aria-label={successChanceLabel}
                      >
                        {Math.round(Number(displayedSuccessChance))}% chance
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.055] p-3">
                  <p className="text-sm font-semibold text-white">
                    {completedFactSheetItems} / {factSheetCompletionItems.length} sections discovered
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/55">
                    {isInterview
                      ? "Cross-check each section before taking the case to court."
                      : "Use these sections as your courtroom reference."}
                  </p>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {factSheetSections.map((section) => {
                      const Icon =
                        section.icon ||
                        factSheetSectionIconMap[section.key] ||
                        HeroIcons.DocumentTextIcon;
                      const items = ensureDraftList(factSheetDraft[section.key]);
                      const isSelected = activeMobileFactSheetKey === section.key;

                      return (
                        <button
                          key={`desktop-${section.key}`}
                          type="button"
                          className={`relative flex min-h-[3.85rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 text-center transition ${
                            isSelected
                              ? "border-amber-200/45 bg-amber-200/12 text-amber-100"
                              : items.length
                              ? "border-emerald-300/25 bg-emerald-300/8 text-emerald-100"
                              : "border-white/10 bg-black/18 text-white/48"
                          } ${getFactSheetProgressButtonClass(section.key)}`}
                          onClick={() => openMobileFactSheetDialog(section.key)}
                        >
                          {renderFactSheetProgressBadge(section.key)}
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          <span className="line-clamp-1 text-[0.58rem] font-semibold leading-tight">
                            {factSheetSectionCompactLabel[section.key] || section.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 arena-progress-track">
                    <div
                      className="arena-progress-fill"
                      style={{ width: `${roundedFactSheetProgressPercent}%` }}
                    />
                  </div>
                  {activeMobileFactSheetSection ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/18 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                        {activeMobileFactSheetSection.title}
                      </p>
                      {activeMobileFactSheetItems.length > 0 ? (
                        <p className="mt-2 line-clamp-3 text-sm font-semibold leading-6 text-white/78">
                          {activeMobileFactSheetItems[0]}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-white/45">
                          {activeMobileFactSheetSection.empty}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 space-y-3">
                  {factSheetSections.map(renderFactSheetSection)}

                  {isInterview && (
                    <div className="space-y-3">
                      {isIntakeLocked || awaitingSettlementResponse || settlementAuthorityReady ? (
                        <div className="arena-surface-soft p-4 text-sm leading-6 text-white/68">
                          {settlementAuthorityReady
                            ? "Your client has given settlement authority. Send settlement intent before continuing intake."
                            : awaitingSettlementResponse
                            ? "Settlement intent has been sent. Waiting for opposing counsel to respond."
                            : apiConfig.intakeLockedMessage ||
                              "Your fact sheet is finalized. Waiting for the other side."}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="arena-btn-light w-full px-5 py-3"
                        onClick={handleFactSheetPrimaryAction}
                        disabled={factSheetPrimaryActionDisabled}
                      >
                        {settlementAuthorityReady
                          ? "Send Settlement Intent First"
                          : awaitingSettlementResponse
                          ? "Awaiting Response"
                          : isIntakeLocked
                          ? "Waiting for Opponent"
                          : pendingAction === "finalize"
                          ? "Finalizing Fact Sheet..."
                          : "Finalize Fact Sheet"}
                      </button>
                      {renderSettleButton("arena-btn-dark w-full px-5 py-3")}
                      {pendingAction === "finalize" ? (
                        <LoadingBar label="Finalizing fact sheet" />
                      ) : null}
                      {finalizeFeedback?.text ? (
                        <p
                          className={`text-sm leading-6 ${
                            finalizeFeedback.tone === "error"
                              ? "text-rose-200"
                              : "text-emerald-200"
                          }`}
                        >
                          {finalizeFeedback.text}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isInterview ? (
              <>
                <div className="arena-surface">
                  <div className="p-4 sm:p-6">
                    <p className="arena-kicker">Intake Progress</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h2 className="arena-headline text-2xl">Build the record</h2>
                      {!isSettlement && !isSettled && Number.isFinite(Number(displayedSuccessChance)) ? (
                        <span
                          className="badge border border-sky-300/35 bg-sky-300/10 px-3 py-3 text-sky-100"
                          data-tooltip-id="success-chance-tooltip"
                          aria-label={successChanceLabel}
                        >
                          {Math.round(Number(displayedSuccessChance))}% chance
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-5 flex items-center gap-4">
                      <IntakeProgressRing value={roundedFactSheetProgressPercent} />
                      <div className="text-sm text-white/62">
                        <p className="font-semibold text-white">Next up</p>
                        <p className="mt-1">{nextFactSheetStep}</p>
                        <p className="mt-2">
                          {completedFactSheetItems} of {factSheetCompletionItems.length} draft
                          sections filled.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="arena-surface">
                  <div className="p-4 sm:p-6">
                    <p className="arena-kicker">Case Quick Links</p>
                    <div className="mt-5 space-y-3">
                      <a
                        href="#"
                        className="arena-surface-soft flex min-w-0 items-center justify-between gap-3 px-4 py-3 text-sm text-white/72"
                      >
                        <span className="shrink-0">Case details</span>
                        <span className="min-w-0 truncate text-white/35">
                          {caseSession.premise.courtName}
                        </span>
                      </a>
                      <a
                        href="#"
                        className="arena-surface-soft flex min-w-0 items-center justify-between gap-3 px-4 py-3 text-sm text-white/72"
                      >
                        <span className="shrink-0">Opponent</span>
                        <span className="min-w-0 truncate text-white/35">{opponentPartyName}</span>
                      </a>
                      <a
                        href="#"
                        className="arena-surface-soft flex min-w-0 items-center justify-between gap-3 px-4 py-3 text-sm text-white/72"
                      >
                        <span className="shrink-0">Public case feed</span>
                        <span className="min-w-0 truncate text-white/35">
                          {caseSession.primaryCategory}
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              </>
            ) : isSettlement || isSettled || isCourtroom ? null : (
              <div id="lawbook-details" className="arena-surface">
                <details className="group" open>
                  <summary className="list-none cursor-pointer p-6">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="arena-kicker">Lawbook</p>
                        <h2 className="arena-headline mt-2 text-2xl">Rules in play</h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs uppercase tracking-[0.15em] text-white/40">
                          {visibleLawbookRules.length} of {lawbookRules.length}
                        </span>
                        <CollapseChevron />
                      </div>
                    </div>
                    {renderLawbookFilters()}
                  </summary>
                  <div className="px-6 pb-6">
                    <p className="mb-4 text-sm text-white/48">
                      Showing {selectedLawbookCategoryTitle.toLowerCase()} rules plus universal
                      courtroom principles.
                    </p>
                    <div className="space-y-3">
                      {visibleLawbookRules.map((rule) => renderLawbookRuleCard(rule, true))}
                    </div>
                  </div>
                </details>
              </div>
            )}
              </>
            )}
          </aside>
          {(isInterview || isCourtroom) &&
            renderLawbookPanel("hidden sm:block xl:hidden", "tablet-lawbook-details")}
        </div>
      </section>
      <div
        className={`modal modal-bottom sm:hidden ${
          showMobileBriefDialog ? "modal-open" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!showMobileBriefDialog}
        aria-label="Case brief"
      >
        <div className="modal-box max-h-[86vh] overflow-hidden rounded-t-2xl border border-white/[0.07] bg-[#070908] p-0 text-white shadow-2xl">
          <div className="border-b border-white/[0.06] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                  Case brief
                </p>
                <h2 className="mt-1 text-xl font-semibold leading-tight text-white">
                  {caseSession.title}
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-circle btn-ghost btn-sm shrink-0 border border-white/[0.06] text-white/65 hover:border-white/12 hover:bg-white/[0.04] hover:text-white"
                onClick={() => setShowMobileBriefDialog(false)}
                aria-label="Close case brief"
              >
                <HeroIcons.XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="max-h-[64vh] space-y-4 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-sky-300/20 bg-sky-300/[0.06] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">
                  You
                </p>
                <p className="mt-1 font-semibold text-white">{playerPartyName}</p>
              </div>
              <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-200">
                  Opponent
                </p>
                <p className="mt-1 font-semibold text-white">{opponentPartyName}</p>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                Matter
              </p>
              <p className="mt-2 text-sm leading-6 text-white/74">
                {caseSession.premise?.overview || heroNarrativeExcerpt}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                Requested relief
              </p>
              <p className="mt-2 text-sm leading-6 text-white/74">
                {caseSession.premise?.desiredRelief || "No requested relief is recorded yet."}
              </p>
            </div>
            {caseSession.premise?.openingStatement ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                  Opening position
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/74">
                  {caseSession.premise.openingStatement}
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="modal-backdrop bg-black/55 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Close case brief"
            onClick={() => setShowMobileBriefDialog(false)}
          >
            close
          </button>
        </div>
      </div>
      <div
        className={`modal modal-bottom sm:hidden ${
          showMobileLawbookDialog ? "modal-open" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!showMobileLawbookDialog}
        aria-label="Lawbook reference"
      >
        <div className="modal-box max-h-[86vh] overflow-hidden rounded-t-2xl border border-white/[0.07] bg-[#070908] p-0 text-white shadow-2xl">
          <div className="border-b border-white/[0.06] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                  Lawbook
                </p>
                <h2 className="mt-1 text-xl font-semibold leading-tight text-white">
                  Rules Reference
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-circle btn-ghost btn-sm shrink-0 border border-white/[0.06] text-white/65 hover:border-white/12 hover:bg-white/[0.04] hover:text-white"
                onClick={() => setShowMobileLawbookDialog(false)}
                aria-label="Close lawbook reference"
              >
                <HeroIcons.XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {renderLawbookFilters()}
          </div>
          <div className="max-h-[58vh] overflow-y-auto p-4">
            <p className="mb-4 text-sm text-white/48">
              Showing {selectedLawbookCategoryTitle.toLowerCase()} rules plus universal
              courtroom principles.
            </p>
            <div className="space-y-3">
              {visibleLawbookRules.length > 0 ? (
                visibleLawbookRules.map((rule) => renderLawbookRuleCard(rule, true))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/45">
                  No matching rules.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-backdrop bg-black/55 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Close lawbook reference"
            onClick={() => setShowMobileLawbookDialog(false)}
          >
            close
          </button>
        </div>
      </div>
      <div
        className={`modal modal-bottom sm:modal-middle ${
          showMobileFactSheetDialog ? "modal-open" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!showMobileFactSheetDialog}
        aria-label={`${activeMobileFactSheetSection?.title || "Case file"} reference`}
      >
        <div className="modal-box flex max-h-[92vh] overflow-hidden rounded-t-2xl border border-white/[0.07] bg-[#070908] p-0 text-white shadow-2xl sm:h-[min(54rem,calc(100vh-2rem))] sm:w-[min(46rem,calc(100vw-3rem))] sm:max-w-none sm:flex-col sm:rounded-2xl">
          {activeMobileFactSheetSection ? (
            <>
              <div className="border-b border-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
                    Case file reference
                  </p>
                  <h2 className="mt-1 text-xl font-semibold leading-tight text-white">
                    {activeMobileFactSheetSection.title}
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn btn-circle btn-ghost btn-sm shrink-0 border border-white/[0.06] text-white/65 hover:border-white/12 hover:bg-white/[0.04] hover:text-white"
                  onClick={() => setShowMobileFactSheetDialog(false)}
                  aria-label="Close case file reference"
                >
                  <HeroIcons.XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2">
                {factSheetSections.map((section) => renderMobileFactSheetButton(section))}
              </div>
            </div>

            <div className="flex max-h-[48vh] flex-col p-4 sm:min-h-0 sm:flex-1 sm:max-h-none sm:p-5">
              <p className="text-sm italic leading-6 text-white/52">
                {activeMobileFactSheetSection.description}
              </p>
              {activeMobileFactSheetItems.length > 0 ? (
                <div className="arena-scroll mt-4 min-h-[21.25rem] space-y-3 overflow-y-auto pr-1 sm:h-[24rem] sm:min-h-0 sm:flex-none">
                  {activeMobileFactSheetItems.map((item, itemIndex) => {
                    const bulletTone = getFactSheetItemTone(
                      activeMobileFactSheetSection.key,
                      item
                    );
                    return (
                      <div
                        key={`${activeMobileFactSheetSection.key}-dialog-${itemIndex}`}
                        className="flex min-h-[3.85rem] gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3"
                      >
                        <span
                          className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                            factSheetBulletToneClass[bulletTone] ||
                            factSheetBulletToneClass.secondary
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-6 text-white/80">
                            {activeMobileFactSheetSection.key === "missingEvidence"
                              ? formatMissingEvidenceLabel(item)
                              : item}
                          </p>
                          {isInterview && activeMobileFactSheetSection.key === "missingEvidence" ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {getEvidenceFollowUpQuestions(item)
                                .slice(0, 2)
                                .map((questionText) => (
                                  <button
                                    key={`${activeMobileFactSheetSection.key}-dialog-${itemIndex}-${questionText}`}
                                    type="button"
                                    className="rounded-full border border-amber-200/16 bg-amber-200/[0.055] px-3 py-1.5 text-left text-xs font-semibold text-amber-100 transition hover:border-amber-200/38 hover:bg-amber-200/10"
                                    onClick={() =>
                                      applySuggestedIntakeQuestion(questionText, {
                                        closeFactSheetDialog: true,
                                      })
                                    }
                                    disabled={awaitingSettlementResponse || settlementAuthorityReady}
                                  >
                                    {questionText}
                                  </button>
                                ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/45">
                  {activeMobileFactSheetSection.empty}
                </div>
              )}
              {isInterview ? (
                <div className="mt-4 rounded-2xl border border-white/[0.07] bg-amber-200/[0.045] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                    Before court
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/62">
                    Check each section above. When your theory, proof, risks, and requested relief
                    match the intake record, finalize the fact sheet.
                  </p>
                  <button
                    type="button"
                    className="btn mt-3 min-h-0 w-full border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-semibold text-black hover:border-amber-100 hover:bg-amber-100 disabled:opacity-60"
                    onClick={handleFactSheetPrimaryAction}
                    disabled={factSheetPrimaryActionDisabled}
                  >
                    {settlementAuthorityReady
                      ? "Send Settlement Intent First"
                      : awaitingSettlementResponse
                      ? "Awaiting Response"
                      : isIntakeLocked
                      ? "Waiting for Opponent"
                      : pendingAction === "finalize"
                      ? "Finalizing Fact Sheet..."
                      : "Finalize Fact Sheet"}
                  </button>
                  {renderSettleButton(
                    "btn mt-2 min-h-0 w-full border-emerald-200/25 bg-emerald-200/[0.08] px-4 py-3 text-sm font-semibold text-emerald-50 hover:border-emerald-200/50 hover:bg-emerald-200/[0.12] disabled:opacity-60"
                  )}
                  {pendingAction === "finalize" ? (
                    <div className="mt-3">
                      <LoadingBar label="Finalizing fact sheet" />
                    </div>
                  ) : null}
                  {finalizeFeedback?.text ? (
                    <p
                      className={`mt-3 text-xs leading-5 ${
                        finalizeFeedback.tone === "error"
                          ? "text-rose-200"
                          : "text-emerald-200"
                      }`}
                    >
                      {finalizeFeedback.text}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-sky-200/12 bg-sky-200/[0.045] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
                    Court reference
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/62">
                    Use these points to ground your next argument in facts, proof, risks, and
                    requested relief.
                          </p>
                        </div>
                      )}

                      {latestEvidenceProductionQuestions.length > 0 ? (
                        <div className="mt-3 rounded-xl border border-amber-200/18 bg-amber-200/[0.055] p-3">
                          <div className="flex items-start gap-3">
                            <HeroIcons.DocumentMagnifyingGlassIcon
                              className="mt-0.5 h-5 w-5 shrink-0 text-amber-200"
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                                Turn evidence into proof
                              </p>
                              <p className="mt-1 text-sm leading-6 text-white/62">
                                Ask them to read, quote, or describe the record so it can help in court.
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {latestEvidenceProductionQuestions.slice(0, 2).map((item) => (
                                  <button
                                    key={`latest-evidence-desktop-${item}`}
                                    type="button"
                                    className="rounded-full border border-amber-200/20 bg-black/18 px-3 py-1.5 text-left text-xs font-semibold text-amber-100 transition hover:border-amber-200/45 hover:bg-amber-200/10"
                                    onClick={() => applySuggestedIntakeQuestion(item)}
                                    disabled={awaitingSettlementResponse || settlementAuthorityReady}
                                  >
                                    {item}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
            </>
          ) : null}
        </div>
        <div className="modal-backdrop bg-black/55 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Close case file reference"
            onClick={() => setShowMobileFactSheetDialog(false)}
          >
            close
          </button>
        </div>
      </div>
      <div
        className={`modal modal-bottom sm:modal-middle ${
          showSettlementDialog ? "modal-open" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!showSettlementDialog}
        aria-label="Start settlement"
      >
        <div className="modal-box max-h-[90vh] overflow-hidden rounded-t-2xl border border-emerald-200/15 bg-[#070908] p-0 text-white shadow-2xl shadow-black/70 sm:w-[min(42rem,calc(100vw-3rem))] sm:max-w-none sm:rounded-2xl">
          <div className="relative overflow-hidden border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(0,0,0,0.08))] p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-4">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-300/[0.08] text-emerald-100 sm:flex">
                  <HeroIcons.ScaleIcon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="arena-kicker text-emerald-200">Settlement</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                    {pendingSettlementIntentFromOther ? "Respond to settlement intent" : "Send settlement intent"}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
                    {pendingSettlementIntentFromOther
                      ? "Your client has authority to explore settlement. Send a practical response that can open talks."
                      : "Tell opposing counsel you want to explore settlement. They still need to ask their own client before talks open."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-circle btn-ghost btn-sm shrink-0 border border-white/[0.08] bg-black/20 text-white/65 hover:border-white/16 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setShowSettlementDialog(false)}
                aria-label="Close settlement dialog"
              >
                <HeroIcons.XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            {settlementRejected ? (
              <div className="overflow-hidden rounded-2xl border border-rose-300/22 bg-rose-400/[0.07]">
                <div className="flex gap-3 border-b border-white/[0.06] bg-black/18 p-4 sm:p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200/20 bg-rose-300/[0.08] text-rose-100">
                    <HeroIcons.NoSymbolIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-rose-100">The other side rejected settlement.</p>
                    <p className="mt-1 text-sm leading-6 text-white/62">
                      Keep gathering facts or move the dispute into court.
                    </p>
                    {isSettlementCooldownActive ? (
                      <p className="mt-2 inline-flex rounded-full border border-white/10 bg-black/22 px-3 py-1 text-xs font-semibold text-white/72">
                        Settlement retry opens in {settlementCooldownLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
                  <button
                    type="button"
                    className="arena-btn-dark px-4 py-3"
                    onClick={handleSettlementExit}
                    disabled={working}
                  >
                    Continue Intake
                  </button>
                  <button
                    type="button"
                    className="arena-btn-light px-4 py-3"
                    onClick={() => {
                      setShowSettlementDialog(false);
                      handleFinalize();
                    }}
                    disabled={working}
                  >
                    Finalize Fact Sheet
                  </button>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSettlementStartSubmit}>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/28 shadow-inner shadow-black/30 transition focus-within:border-emerald-200/45 focus-within:bg-black/36">
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/44">
                      <HeroIcons.PencilSquareIcon className="h-4 w-4 text-emerald-200/80" aria-hidden="true" />
                      {pendingSettlementIntentFromOther ? "Response message" : "Intent message"}
                    </div>
                    <span className="shrink-0 text-xs text-white/32">
                      {settlementMessage.trim().length} chars
                    </span>
                  </div>
                  <textarea
                    value={settlementMessage}
                    onChange={(event) => setSettlementMessage(event.target.value)}
                    rows={7}
                    className="block min-h-48 w-full resize-none border-0 bg-transparent px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-white/34 focus:outline-none"
                    placeholder={
                      pendingAction === "settlement-draft"
                        ? "Drafting an opening settlement message..."
                        : pendingSettlementIntentFromOther
                        ? "Example: My client is open to discussing settlement if your side can address..."
                        : "Example: My client is interested in exploring settlement before court if your side is open to talks..."
                    }
                    disabled={working || isSettlementCooldownActive}
                  />
                </div>
                <button
                  type="submit"
                  className="arena-btn-light flex w-full items-center justify-center gap-2 px-5 py-3.5 shadow-lg shadow-amber-950/20 disabled:cursor-not-allowed disabled:opacity-55"
                  disabled={working || isSettlementCooldownActive || !settlementMessage.trim()}
                >
                  <HeroIcons.PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />
                  {isSettlementCooldownActive
                    ? `Retry in ${settlementCooldownLabel}`
                    : pendingAction === "settlement-draft"
                    ? "Drafting..."
                    : pendingAction === "settlement-start"
                    ? "Sending..."
                    : pendingSettlementIntentFromOther
                    ? "Send Settlement Response"
                    : "Send Settlement Intent"}
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="modal-backdrop bg-black/55 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Close settlement dialog"
            onClick={() => setShowSettlementDialog(false)}
          >
            close
          </button>
        </div>
      </div>
      {showClientWalkoutModal ? (
        <div
          className="modal modal-middle modal-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-walkout-title"
        >
          <div className="modal-box max-w-md rounded-2xl border border-red-300/15 bg-[#090707] p-0 text-white shadow-2xl shadow-black/70">
            <div className="border-b border-red-300/10 p-5">
              <p className="arena-kicker text-red-200">Settlement ended</p>
              <h3 id="client-walkout-title" className="mt-2 text-2xl font-black text-white">
                Your client wants to walk out
              </h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-white/64">
                Settlement talks are over for now. Return to intake and keep building the case.
              </p>
            </div>
            <div className="p-5">
              <div className="rounded-xl border border-red-300/[0.08] bg-red-300/[0.055] p-4 text-sm font-semibold leading-6 text-red-50">
                You can return to intake in {clientWalkoutCountdown}s.
              </div>
              <button
                type="button"
                className="arena-btn-light mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleClientWalkoutReturnToIntake}
                disabled={clientWalkoutCountdown > 0}
              >
                Return to intake
                <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/65 backdrop-blur-[2px]" />
        </div>
      ) : null}
      <IntakeTourOverlay
        isOpen={showIntakeTour && isInterview}
        onComplete={() => setShowIntakeTour(false)}
        analyticsContext={tourAnalyticsContext}
      />
      <SettlementTourOverlay
        isOpen={showSettlementTour && isSettlement}
        onComplete={() => setShowSettlementTour(false)}
        analyticsContext={tourAnalyticsContext}
      />
      {!isSettlement && !isSettled && Number.isFinite(Number(displayedSuccessChance)) ? (
        <Tooltip
          id="success-chance-tooltip"
          className="z-[70] !max-w-none !rounded-lg !border !border-white/10 !bg-[#141414] !px-4 !py-3 !opacity-100 shadow-xl"
        >
          <SuccessChanceTooltip reasons={successChanceReasons} isInterview={isInterview} />
        </Tooltip>
      ) : null}
      <Tooltip
        id="settlement-authority-tooltip"
        className="z-[70] !max-w-xs !rounded-lg !border !border-white/10 !bg-[#141414] !px-4 !py-3 !text-sm !leading-5 !text-white !opacity-100 shadow-xl"
      />
    </main>
  );
}
