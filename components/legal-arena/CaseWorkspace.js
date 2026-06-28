"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tooltip } from "react-tooltip";
import { toast } from "react-hot-toast";
import * as HeroIcons from "@heroicons/react/24/outline";
import ButtonAccount from "@/components/ButtonAccount";
import { useNavigationLoading } from "@/components/NavigationLoadingProvider";
import apiClient from "@/libs/api";
import {
  LAWBOOK_ALL_CATEGORIES,
  legalArenaLawbook,
} from "@/data/legalArenaLawbook";
import { LEGAL_CASE_CATEGORIES } from "@/libs/game/categories";
import { sanitizeFactSheet } from "@/libs/game/factSheetSanitizer";
import { useCaseVoiceRecorder } from "./useCaseVoiceRecorder";

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

const missingEvidenceUnavailablePattern =
  /\b(no|none|never|does not exist|doesn't exist|did not exist|didn't exist|not available|unavailable|cannot get|can't get|unobtainable|destroyed|lost|client never|never took|never received|other side has|opposing side has|landlord has|tenant has|third party has|only the other side|not provided to me)\b/i;

const missingEvidenceUncertainPattern =
  /\b(any|if one exists|if it exists|may have|might have|should have|could have|likely has|prepared but did not provide|do not know|don't know|not sure|need to ask|need to confirm)\b/i;

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
  const [question, setQuestion] = useState("");
  const [argument, setArgument] = useState("");
  const [working, setWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [pendingSpeaker, setPendingSpeaker] = useState("");
  const [finalizeFeedback, setFinalizeFeedback] = useState(null);
  const [optimisticTranscriptEntry, setOptimisticTranscriptEntry] = useState(null);
  const [selectedLawbookCategory, setSelectedLawbookCategory] = useState(
    initialCase.primaryCategory || LAWBOOK_ALL_CATEGORIES
  );
  const [lawbookSearch, setLawbookSearch] = useState("");
  const [showFullMobileBrief, setShowFullMobileBrief] = useState(false);
  const [showMobileExchangeHistory, setShowMobileExchangeHistory] = useState(false);
  const [showFullMobileOpponentArgument, setShowFullMobileOpponentArgument] = useState(false);
  const [activeMobileFactSheetKey, setActiveMobileFactSheetKey] = useState("theory");
  const [showMobileFactSheetDialog, setShowMobileFactSheetDialog] = useState(false);
  const [showMobileBriefDialog, setShowMobileBriefDialog] = useState(false);
  const [showMobileLawbookDialog, setShowMobileLawbookDialog] = useState(false);
  const interviewTranscriptRef = useRef(null);
  const courtroomTranscriptRef = useRef(null);
  const workingRef = useRef(false);
  const updateCaseFromResponseRef = useRef(null);
  const {
    recordingQuestion,
    transcribingQuestion,
    recordingArgument,
    transcribingArgument,
    argumentAudioLevel,
    handleQuestionVoiceInput,
    handleArgumentVoiceInput,
  } = useCaseVoiceRecorder({ setQuestion, setArgument });
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
  const realtimeRefreshPath = apiConfig.realtimeRefreshPath || getApiBasePath(caseSession);
  const realtimeRefreshIntervalMs = apiConfig.realtimeRefreshIntervalMs || 4000;
  const getResponseCase = (response) =>
    apiConfig.responseToCase ? apiConfig.responseToCase(response) : response?.caseSession;
  const updateCaseFromResponse = (response) => {
    const nextCase = getResponseCase(response);

    if (!nextCase) {
      return null;
    }

    setCaseSession({
      ...nextCase,
      factSheet: sanitizeFactSheet(nextCase.factSheet || {}),
    });

    return nextCase;
  };

  useEffect(() => {
    workingRef.current = working;
  }, [working]);

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
  const isInterview = caseSession.status === "interview";
  const isVerdict = caseSession.status === "verdict";
  const isExited = caseSession.status === "exited";
  const isIntakeLocked = Boolean(apiConfig.intakeLocked);
  const viewerSubmittedCurrentRound = Boolean(caseSession.score.viewerSubmittedCurrentRound);

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
    if (!apiConfig.realtimeRefresh || isVerdict || isExited || !realtimeRefreshPath) {
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
    isExited,
    realtimeRefreshIntervalMs,
    realtimeRefreshPath,
  ]);

  const handleChatTextareaKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent?.isComposing) {
      return;
    }

    event.preventDefault();

    if (working) {
      return;
    }

    const form = event.currentTarget.form;
    if (!form) {
      return;
    }

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };

  const handleInterviewSubmit = async (event) => {
    event.preventDefault();
    if (working || isIntakeLocked || !question.trim()) return;

    const submittedQuestion = question.trim();

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

      updateCaseFromResponse(response);
    } catch (error) {
      setQuestion(submittedQuestion);
      console.error(error);
    } finally {
      setOptimisticTranscriptEntry(null);
      setPendingSpeaker("");
      setPendingAction("");
      setWorking(false);
    }
  };

  const handleFinalize = async () => {
    if (working || isIntakeLocked) {
      return;
    }

    setFinalizeFeedback(null);
    setWorking(true);
    setPendingAction("finalize");

    try {
      const response = await apiClient.post(
        `${getApiBasePath(caseSession)}/${apiConfig.finalizePath || "finalize"}`,
        {
          factSheet: buildFactSheetPayload(),
        }
      );

      const nextCase = updateCaseFromResponse(response);
      const successMessage =
        apiConfig.finalizeSuccessMessage ||
        (nextCase?.status === "courtroom"
          ? "Fact sheet finalized. Court is open."
          : "Fact sheet finalized.");
      setFinalizeFeedback({ tone: "success", text: successMessage });
      toast.success(successMessage);
    } catch (error) {
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

  const handleCourtroomSubmit = async (event) => {
    event.preventDefault();
    if (working || showCourtroomWaitingCard || !argument.trim()) return;

    const submittedArgument = argument.trim();

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
    } catch (error) {
      setArgument(submittedArgument);
      console.error(error);
    } finally {
      setOptimisticTranscriptEntry(null);
      setPendingSpeaker("");
      setPendingAction("");
      setWorking(false);
    }
  };

  const handleExitCase = async () => {
    const confirmed = window.confirm(
      apiConfig.exitConfirm ||
        "Exit this case? You will not be able to start the same case again for 24 hours."
    );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setPendingAction("exit");

    try {
      const response = await apiClient.post(
        `${getApiBasePath(caseSession)}/${apiConfig.exitPath || "exit"}`
      );

      if (apiConfig.exitStaysInWorkspace) {
        updateCaseFromResponse(response);
      } else {
        startNavigationLoading(apiConfig.exitLoadingLabel || "Returning to the docket");
        router.push(apiConfig.exitRedirect || "/dashboard");
        router.refresh();
      }
    } catch (error) {
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
  const mobileInterviewExchangeHistory = mobileInterviewExchangePairs
    .slice(0, -1)
    .reverse();
  const opponentPartyName = getOpponentPartyName(caseSession);
  const defendantName = getDefendantName(caseSession);
  const isDefendantSide =
    caseSession.playerSide === "opponent" ||
    playerPartyName.trim().toLowerCase() === defendantName.trim().toLowerCase();
  const waitingForPlaintiffOpening = Boolean(
    apiConfig.requirePlaintiffOpening &&
      isDefendantSide &&
      caseSession.score.roundsCompleted === 0 &&
      !viewerSubmittedCurrentRound
  );
  const lastCourtroomEntry =
    normalizedCourtroomTranscript[normalizedCourtroomTranscript.length - 1] || null;
  const waitingForOpponentResponse = Boolean(
    apiConfig.turnBasedCourtroom && lastCourtroomEntry?.speaker === "player"
  );
  const showCourtroomWaitingCard = Boolean(
    !isVerdict &&
      (waitingForPlaintiffOpening ||
        viewerSubmittedCurrentRound ||
        waitingForOpponentResponse)
  );
  const sideBadgeLabel =
    caseSession.playerSide === "opponent" ? "Defendant Side" : "Plaintiff Side";
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
  const opponentCourtPortrait = String(caseSession.opponentPortrait?.image || "").trim();
  const playerCourtPortrait = String(caseSession.playerImage || "").trim() || "/images/profile.jpg";

  const courtroomStageLabel = useMemo(() => {
    if (isExited) return "Exited";
    if (isInterview) return "Party Intake";
    if (isVerdict) return "Verdict";
    return `Courtroom Round ${caseSession.score.roundsCompleted + 1}`;
  }, [caseSession.score.roundsCompleted, isExited, isInterview, isVerdict]);

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
  const isCourtroom = !isInterview && !isExited && !isVerdict;
  const courtroomRoundLabel = `Courtroom Round ${caseSession.score.roundsCompleted + 1}`;
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
    String(caseSession.clientMemoryExcerpt || "").trim() ||
    String(caseSession.premise?.openingStatement || "").trim() ||
    String(caseSession.premise?.overview || "").trim();
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
  const lastOpponentCourtEntryKey = lastOpponentCourtEntry
    ? `${lastOpponentCourtEntry.round || ""}-${lastOpponentCourtEntry.text || ""}`
    : "";
  const lastOpponentCourtEntryDisplayRound = Math.max(
    Number(lastOpponentCourtEntry?.round || 0),
    Math.min(caseSession.score.roundsCompleted + 1, caseSession.maxCourtRounds || 1)
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
                    <p className="min-w-0 flex-1 text-sm leading-7 text-white/78">
                      {section.key === "missingEvidence"
                        ? formatMissingEvidenceLabel(item)
                        : item}
                    </p>
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
    setActiveMobileFactSheetKey(sectionKey);
    setShowMobileFactSheetDialog(true);
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
        className={`min-h-[4.05rem] rounded-xl border p-2 text-center transition ${
          isSelected
            ? "border-amber-200/45 bg-amber-300/12 text-amber-100"
            : isComplete
            ? "border-emerald-300/25 bg-emerald-300/8"
            : "border-white/10 bg-white/[0.025]"
        } ${className}`}
        onClick={() => openMobileFactSheetDialog(section.key)}
      >
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
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-3 pb-24 pt-4 sm:px-4 sm:py-6 md:px-8 md:py-10">
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
              {isInterview ? (
                <button
                  type="button"
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-300/22 bg-rose-500/10 px-3 text-xs font-semibold text-rose-100 transition hover:border-rose-200/45 hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={handleExitCase}
                  disabled={working}
                  aria-label={apiConfig.exitLabel || "Exit case"}
                >
                  <HeroIcons.XMarkIcon className="h-4 w-4" aria-hidden="true" />
                  Exit
                </button>
              ) : null}
              <ButtonAccount />
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-semibold leading-tight text-white">
            {caseSession.title}
          </h1>
          <div className="mt-3 flex items-center gap-2 overflow-hidden">
            <span
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                caseSession.playerSide === "opponent"
                  ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
                  : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              }`}
            >
              {sideBadgeLabel}
            </span>
            <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs font-semibold text-white/72">
              {isCourtroom ? courtroomRoundLabel : courtroomStageLabel}
            </span>
            {Number.isFinite(Number(displayedSuccessChance)) ? (
              <span
                className="shrink-0 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100"
                data-tooltip-id="success-chance-tooltip"
                aria-label={successChanceLabel}
              >
                Win chance {Math.round(Number(displayedSuccessChance))}%
              </span>
            ) : null}
          </div>
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
        </div>

        <div
          id="case-brief-desktop"
          className="arena-surface hidden overflow-hidden sm:block"
        >
          <div className="border-b border-white/10 p-4 sm:p-5">
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
                  <h1 className="mt-1 truncate text-2xl font-semibold leading-tight text-white">
                    {caseSession.title}
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    caseSession.playerSide === "opponent"
                      ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
                      : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                  }`}
                >
                  {sideBadgeLabel}
                </span>
                <span
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold arena-status ${
                    statusTone[caseSession.status] || "arena-status-neutral"
                  }`}
                >
                  {isCourtroom ? courtroomRoundLabel : courtroomStageLabel}
                </span>
                {Number.isFinite(Number(displayedSuccessChance)) ? (
                  <span
                    className="shrink-0 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100"
                    data-tooltip-id="success-chance-tooltip"
                    aria-label={successChanceLabel}
                  >
                    Win chance {Math.round(Number(displayedSuccessChance))}%
                  </span>
                ) : null}
                {isInterview ? (
                  <button
                    type="button"
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-300/22 bg-rose-500/10 px-3 text-xs font-semibold text-rose-100 transition hover:border-rose-200/45 hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={handleExitCase}
                    disabled={working}
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
                    You
                  </p>
                  <p className="mt-1 truncate font-semibold text-white">{playerPartyName}</p>
                </div>
                <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-200">
                    Opponent
                  </p>
                  <p className="mt-1 truncate font-semibold text-white">{opponentPartyName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="min-w-0 space-y-6">
            {isInterview ? (
              <>
              <div className="space-y-4 pb-24 sm:hidden">
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
                      <span className="rounded-full border border-white/10 bg-black/24 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-white/48">
                        {question.trim().length}/500
                      </span>
                    </div>

                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
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

                      {showMobileExchangeHistory && mobileInterviewExchangeHistory.length > 0 ? (
                        <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                          {mobileInterviewExchangeHistory.map((exchange) => (
                            <article
                              key={exchange.id}
                              className="rounded-xl border border-white/10 bg-black/18 p-3"
                            >
                              <p className="break-words text-xs font-semibold leading-5 text-white/82">
                                <span className="text-white/44">You: </span>
                                {exchange.question.text}
                              </p>
                              {exchange.response ? (
                                <p className="mt-2 break-words text-xs font-semibold leading-5 text-white/68">
                                  <span className="text-amber-200/72">
                                    {getInterviewEntrySpeaker(exchange.response)}:{" "}
                                  </span>
                                  {exchange.response.text}
                                </p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="relative mt-3">
                      <textarea
                        className="textarea textarea-bordered arena-textarea arena-field h-24 min-w-0 w-full pr-12 text-slate-100"
                        placeholder={`Type your question to ${playerInterviewSubjectName}...`}
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={handleChatTextareaKeyDown}
                        disabled={transcribingQuestion}
                      />
                      <button
                        type="button"
                        className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border ${
                          recordingQuestion
                            ? "border-rose-300/35 bg-rose-400/15 text-rose-100"
                            : "border-white/10 bg-black/24 text-white/58"
                        }`}
                        disabled={working || transcribingQuestion}
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
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={working || recordingQuestion || transcribingQuestion || !question.trim()}
                    >
                      {pendingAction === "interview" ? "Sending..." : "Send Question"}
                      <HeroIcons.PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {suggestedQuestions.length > 0 ? (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {suggestedQuestions.slice(0, 3).map((item) => (
                          <button
                            key={item}
                            type="button"
                            className="shrink-0 rounded-full border border-white/10 bg-black/24 px-3 py-2 text-xs font-semibold text-white/74"
                            onClick={() => setQuestion(item)}
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
                        Ask the right questions to uncover facts and build your case.
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
                      {isIntakeLocked ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/18 p-3 text-xs leading-5 text-white/60">
                          {apiConfig.intakeLockedMessage ||
                            "Your fact sheet is finalized. Waiting for the other side."}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleFinalize}
                        disabled={working || isIntakeLocked}
                      >
                        {isIntakeLocked
                          ? "Waiting for Opponent"
                          : pendingAction === "finalize"
                          ? "Finalizing Fact Sheet..."
                          : "Finalize Fact Sheet"}
                        <HeroIcons.ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
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

                {visibleLawbookRules[0] ? (
                  <section id="lawbook" className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-300/12 text-emerald-200">
                        <LawbookRuleIcon icon={visibleLawbookRules[0].icon} className="h-6 w-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-emerald-200">Relevant rule unlocked</p>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-emerald-50">
                          {visibleLawbookRules[0].title}
                        </p>
                      </div>
                      <a
                        href="#mobile-lawbook-details"
                        className="shrink-0 rounded-xl border border-white/15 bg-black/18 px-3 py-2 text-xs font-semibold text-white/82"
                      >
                        View
                      </a>
                    </div>
                  </section>
                ) : null}

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
                <section className="arena-surface border-amber-200/20 bg-amber-200/[0.045]">
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
                      <span className="rounded-full border border-white/10 bg-black/24 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white/48">
                        {question.trim().length}/500
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
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

                      {showMobileExchangeHistory && mobileInterviewExchangeHistory.length > 0 ? (
                        <div className="arena-scroll mt-3 max-h-60 space-y-2 overflow-y-auto border-t border-white/10 pt-3">
                          {mobileInterviewExchangeHistory.map((exchange) => (
                            <article
                              key={exchange.id}
                              className="rounded-xl border border-white/10 bg-black/18 p-3"
                            >
                              <p className="break-words text-xs font-semibold leading-5 text-white/82">
                                <span className="text-white/44">You: </span>
                                {exchange.question.text}
                              </p>
                              {exchange.response ? (
                                <p className="mt-2 break-words text-xs font-semibold leading-5 text-white/68">
                                  <span className="text-amber-200/72">
                                    {getInterviewEntrySpeaker(exchange.response)}:{" "}
                                  </span>
                                  {exchange.response.text}
                                </p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="relative mt-4">
                      <textarea
                        className="textarea textarea-bordered arena-textarea arena-field h-28 min-w-0 w-full pr-12 text-slate-100"
                        placeholder={`Type your question to ${playerInterviewSubjectName}...`}
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={handleChatTextareaKeyDown}
                        disabled={transcribingQuestion}
                      />
                      <button
                        type="button"
                        className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border ${
                          recordingQuestion
                            ? "border-rose-300/35 bg-rose-400/15 text-rose-100"
                            : "border-white/10 bg-black/24 text-white/58"
                        }`}
                        disabled={working || transcribingQuestion}
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

                    <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
                      <button
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                        disabled={working || recordingQuestion || transcribingQuestion || !question.trim()}
                      >
                        {pendingAction === "interview" ? "Sending..." : "Send Question"}
                        <HeroIcons.PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {suggestedQuestions.length > 0 ? (
                        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
                          {suggestedQuestions.slice(0, 4).map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="shrink-0 rounded-full border border-white/10 bg-black/24 px-3 py-2 text-xs font-semibold text-white/74"
                              onClick={() => setQuestion(item)}
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
            ) : isExited ? (
              <div className="arena-surface">
                <div className="p-4 sm:p-6">
                  <p className="arena-kicker text-rose-300">Case Exited</p>
                  <h2 className="arena-headline mt-2 text-2xl">This intake was closed</h2>
                  <p className="mt-3 max-w-2xl text-white/66">
                    You exited this matter during intake. The same case stays unavailable for
                    24 hours before it can be started again.
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
                          You: <span className="text-white/72">{playerPartyName}</span>
                        </p>
                        <p className="mt-2 text-sm font-semibold text-rose-300">
                          Opponent: <span className="text-white/72">{opponentPartyName}</span>
                        </p>
                      </div>
                      {Number.isFinite(Number(displayedSuccessChance)) ? (
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
                        Round {caseSession.score.roundsCompleted + 1} of {caseSession.maxCourtRounds}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="arena-surface border-white/10 bg-white/[0.025]">
                  <div className="space-y-4 p-4">
                    <div className="flex items-center gap-3">
                      <CourtPortraitAvatar
                        src={opponentCourtPortrait}
                        alt={`${opponentPartyName} portrait`}
                        className="border border-rose-300/30 bg-rose-400/12 text-rose-100"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-lg font-semibold text-white">{opponentPartyName}</p>
                          <p className="text-2xl font-bold text-rose-300">{Math.round(opponentPressurePct)}%</p>
                        </div>
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
                          alt="Your portrait"
                          className="border border-sky-300/30 bg-sky-400/12 text-sky-100"
                          fallbackIcon={HeroIcons.ShieldCheckIcon}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-lg font-semibold text-white">You</p>
                            <p className="text-2xl font-bold text-sky-300">{Math.round(playerPressurePct)}%</p>
                          </div>
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
                        alt={`${opponentPartyName} portrait`}
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

                {showCourtroomWaitingCard ? (
                  <section className="arena-surface p-4">
                    <p className="font-semibold text-white">{opponentPartyName} is preparing a response...</p>
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
                              alt="Your portrait"
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
                          disabled={transcribingArgument}
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
                        disabled={working || transcribingArgument}
                        onClick={handleArgumentVoiceInput}
                      >
                        {recordingArgument
                          ? "Stop Voice Argument"
                          : transcribingArgument
                          ? "Transcribing"
                          : "Voice Argument"}
                      </button>
                      <button
                        className="w-full rounded-xl border border-white/80 bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={working || recordingArgument || transcribingArgument || !argument.trim()}
                      >
                        {pendingAction === "courtroom" ? "Presenting..." : "Present Argument"}
                        <span className="mt-1 block text-xs font-medium text-blue-800">
                          Submit your argument to the judge
                        </span>
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
                          alt={`${opponentPartyName} portrait`}
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
                            alt="Your portrait"
                            className="border border-sky-300/30 bg-sky-400/12 text-sky-100"
                            fallbackIcon={HeroIcons.ShieldCheckIcon}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate text-lg font-semibold text-white">You</p>
                              <p className="text-2xl font-bold text-sky-300">
                                {Math.round(playerPressurePct)}%
                              </p>
                            </div>
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
                        alt={`${opponentPartyName} portrait`}
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

                {showCourtroomWaitingCard ? (
                  <section className="arena-surface p-4">
                    <p className="font-semibold text-white">
                      {opponentPartyName} is preparing a response...
                    </p>
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
                              alt="Your portrait"
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
                          disabled={transcribingArgument}
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
                          disabled={working || transcribingArgument}
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
                          disabled={working || recordingArgument || transcribingArgument || !argument.trim()}
                        >
                          {pendingAction === "courtroom" ? "Presenting..." : "Present Argument"}
                          <span className="mt-1 block text-xs font-medium text-black/62">
                            Submit your argument to the judge
                          </span>
                        </button>
                      </div>
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
                    {Number.isFinite(Number(displayedSuccessChance)) ? (
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
                          className={`flex min-h-[3.85rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 text-center transition ${
                            isSelected
                              ? "border-amber-200/45 bg-amber-200/12 text-amber-100"
                              : items.length
                              ? "border-emerald-300/25 bg-emerald-300/8 text-emerald-100"
                              : "border-white/10 bg-black/18 text-white/48"
                          }`}
                          onClick={() => setActiveMobileFactSheetKey(section.key)}
                        >
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
                      {isIntakeLocked ? (
                        <div className="arena-surface-soft p-4 text-sm leading-6 text-white/68">
                          {apiConfig.intakeLockedMessage ||
                            "Your fact sheet is finalized. Waiting for the other side."}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="arena-btn-light w-full px-5 py-3"
                        onClick={handleFinalize}
                        disabled={working || isIntakeLocked}
                      >
                        {isIntakeLocked
                          ? "Waiting for Opponent"
                          : pendingAction === "finalize"
                          ? "Finalizing Fact Sheet..."
                          : "Finalize Fact Sheet"}
                      </button>
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
                      {Number.isFinite(Number(displayedSuccessChance)) ? (
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
            ) : isCourtroom ? null : (
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
        className={`modal modal-bottom sm:hidden ${
          showMobileFactSheetDialog ? "modal-open" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!showMobileFactSheetDialog}
        aria-label={`${activeMobileFactSheetSection?.title || "Case file"} reference`}
      >
        <div className="modal-box max-h-[86vh] overflow-hidden rounded-t-2xl border border-white/[0.07] bg-[#070908] p-0 text-white shadow-2xl">
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
              <div className="mt-4 grid grid-cols-4 gap-1.5">
                {factSheetSections.map((section) => renderMobileFactSheetButton(section))}
              </div>
            </div>

            <div className="max-h-[48vh] overflow-y-auto p-4">
              <p className="text-sm italic leading-6 text-white/52">
                {activeMobileFactSheetSection.description}
              </p>
              {activeMobileFactSheetItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {activeMobileFactSheetItems.map((item, itemIndex) => {
                    const bulletTone = getFactSheetItemTone(
                      activeMobileFactSheetSection.key,
                      item
                    );

                    return (
                      <div
                        key={`${activeMobileFactSheetSection.key}-dialog-${itemIndex}`}
                        className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3"
                      >
                        <span
                          className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                            factSheetBulletToneClass[bulletTone] ||
                            factSheetBulletToneClass.secondary
                          }`}
                        />
                        <p className="min-w-0 flex-1 text-sm font-semibold leading-6 text-white/80">
                          {activeMobileFactSheetSection.key === "missingEvidence"
                            ? formatMissingEvidenceLabel(item)
                            : item}
                        </p>
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
                <div className="mt-4 rounded-2xl border border-amber-200/12 bg-amber-200/[0.045] p-3">
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
                    onClick={handleFinalize}
                    disabled={working || isIntakeLocked}
                  >
                    {isIntakeLocked
                      ? "Waiting for Opponent"
                      : pendingAction === "finalize"
                      ? "Finalizing Fact Sheet..."
                      : "Finalize Fact Sheet"}
                  </button>
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
      {Number.isFinite(Number(displayedSuccessChance)) ? (
        <Tooltip
          id="success-chance-tooltip"
          className="z-[70] !max-w-none !rounded-lg !border !border-white/10 !bg-[#141414] !px-4 !py-3 !opacity-100 shadow-xl"
        >
          <SuccessChanceTooltip reasons={successChanceReasons} isInterview={isInterview} />
        </Tooltip>
      ) : null}
    </main>
  );
}
