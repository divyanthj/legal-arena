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
  formatDateTime,
  normalizeCourtroomEntry,
  winnerLabel,
  winnerSignal,
  verdictTone,
  statusTone,
  helpText,
  InfoDot,
  CollapseChevron,
  getRuleTooltip,
  buildCanonicalFactLookup,
  resolveFactReference,
  getPlayerPartyName,
  getOpponentPartyName,
  getPlaintiffName,
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

const AutoResizeTextarea = ({ value, onChange, className = "", ...props }) => {
  const textareaRef = useRef(null);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      onChange={(event) => {
        onChange?.(event);
        requestAnimationFrame(resizeTextarea);
      }}
      rows={1}
      className={`${className} overflow-hidden`}
    />
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
  const interviewTranscriptRef = useRef(null);
  const courtroomTranscriptRef = useRef(null);
  const workingRef = useRef(false);
  const updateCaseFromResponseRef = useRef(null);
  const {
    recordingQuestion,
    transcribingQuestion,
    questionAudioLevel,
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


  const buildFactSheetPayload = () => ({
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

  const visibleInterviewTranscript = optimisticTranscriptEntry
    ? [...caseSession.interviewTranscript, optimisticTranscriptEntry]
    : caseSession.interviewTranscript;

  const visibleCourtroomTranscript = optimisticTranscriptEntry
    ? [...caseSession.courtroomTranscript, optimisticTranscriptEntry]
    : caseSession.courtroomTranscript;
  const normalizedCourtroomTranscript =
    visibleCourtroomTranscript.map(normalizeCourtroomEntry);
  const isInterview = caseSession.status === "interview";
  const isVerdict = caseSession.status === "verdict";
  const isExited = caseSession.status === "exited";
  const isIntakeLocked = Boolean(apiConfig.intakeLocked);
  const viewerSubmittedCurrentRound = Boolean(caseSession.score.viewerSubmittedCurrentRound);
  const waitingForPlaintiffOpening = Boolean(
    apiConfig.requirePlaintiffOpening &&
      caseSession.playerSide === "opponent" &&
      caseSession.score.roundsCompleted === 0 &&
      normalizedCourtroomTranscript.length === 0 &&
      !viewerSubmittedCurrentRound
  );

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
    setPendingSpeaker(getPlayerPartyName(caseSession));

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
    if (working || waitingForPlaintiffOpening || !argument.trim()) return;

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
  const opponentPartyName = getOpponentPartyName(caseSession);
  const plaintiffName = getPlaintiffName(caseSession);
  const defendantName = getDefendantName(caseSession);
  const sideBadgeLabel =
    caseSession.playerSide === "opponent" ? "Defendant Side" : "Plaintiff Side";
  const verdictStyle =
    verdictTone[caseSession.verdict?.winner] || verdictTone.draw;
  const canonicalFactLookup = buildCanonicalFactLookup(caseSession);
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

  const courtroomStageLabel = useMemo(() => {
    if (isExited) return "Exited";
    if (isInterview) return "Party Intake";
    if (isVerdict) return "Verdict";
    return `Courtroom Round ${caseSession.score.roundsCompleted + 1}`;
  }, [caseSession.score.roundsCompleted, isExited, isInterview, isVerdict]);

  const suggestedQuestions = (caseSession.factSheet.openQuestions || []).slice(0, 4);
  const factSheetCompletionItems = [
    factSheetDraft.summary,
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
    (!cleanDraftList(factSheetDraft.summary).length && "Add a case summary") ||
    (!cleanDraftList(factSheetDraft.theory).length && "Shape the case theory") ||
    (!cleanDraftList(factSheetDraft.timeline).length && "Add timeline of events") ||
    (!cleanDraftList(factSheetDraft.supportingFacts).length && "Capture supporting facts") ||
    (!cleanDraftList(factSheetDraft.risks).length &&
      !cleanDraftList(factSheetDraft.disputedFacts).length &&
      "Document a key risk or dispute") ||
    (!cleanDraftList(factSheetDraft.desiredRelief).length && "Add requested relief") ||
    "Review and finalize fact sheet";
  const canEditFactSheet = isInterview && !isIntakeLocked;
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
  const heroPanelStyle = {
    backgroundImage: [
      "linear-gradient(90deg, rgba(4,4,4,0.96) 0%, rgba(4,4,4,0.88) 42%, rgba(4,4,4,0.5) 68%, rgba(4,4,4,0.9) 100%)",
      "linear-gradient(180deg, rgba(18,12,6,0.18), rgba(0,0,0,0.1))",
      `url('${isInterview ? "/images/office.jpg" : "/images/court.jpg"}')`,
    ].join(", "),
    backgroundPosition: "center, center, 72% center",
    backgroundRepeat: "no-repeat, no-repeat, no-repeat",
    backgroundSize: "cover, cover, auto 108%",
  };

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
      )} asks for ${trimmedRelief}`
    );
  };

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
      theory ? `Our position is straightforward: ${theory}` : "",
      strongestFact ? `The record starts with this point: ${strongestFact}` : "",
      rule ? `The governing lens is ${rule.title}: ${rule.principle}` : "",
      liveRisk ? `I also want to address the main weakness directly: ${liveRisk}` : "",
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

    return fact ? `The fact sheet supports this point: ${fact}` : "";
  };

  const riskResponseSnippet = () => {
    const risk = firstDraftItem(factSheetDraft.risks, factSheetDraft.disputedFacts);
    const support = firstDraftItem(factSheetDraft.corroboratedFacts, factSheetDraft.supportingFacts);

    if (!risk) {
      return "";
    }

    return support
      ? `The weakness I need to confront is this: ${risk}\nEven with that pressure, the stronger point for my side is: ${support}`
      : `The weakness I need to confront is this: ${risk}`;
  };

  const proofGapSnippet = () => {
    const gap = firstDraftItem(factSheetDraft.missingEvidence);

    return gap
      ? `The proof gap is real: ${gap}\nSo I am asking the Court to weigh only what the current record actually supports.`
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

  const renderLawbookPanel = (className = "") => (
    <div className={`arena-surface min-w-0 max-w-full overflow-hidden ${className}`}>
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
      key: "summary",
      title: "Case summary",
      empty: "No summary notes yet.",
      placeholder: "Client says...",
    },
    {
      key: "theory",
      title: "Theory",
      empty: "No theory notes yet.",
      placeholder: "My current theory is...",
    },
    {
      key: "timeline",
      title: "Timeline",
      empty: "No timeline points yet.",
      placeholder: "Client says this happened when...",
    },
    {
      key: "supportingFacts",
      title: "Supporting facts",
      empty: "No supporting facts yet.",
      placeholder: "Client says...",
    },
    {
      key: "risks",
      title: "Risks",
      empty: "No risks captured yet.",
      placeholder: "Risk I need to manage...",
    },
    {
      key: "disputedFacts",
      title: "Disputed facts",
      empty: "No disputed facts yet.",
      placeholder: "The other side may dispute...",
    },
    {
      key: "corroboratedFacts",
      title: "Corroborated facts",
      empty: "No corroborated facts yet.",
      placeholder: "Record or witness support...",
    },
    {
      key: "missingEvidence",
      title: "Missing evidence / proof gaps",
      empty: "No proof gaps listed yet.",
      placeholder: "I still need...",
    },
    {
      key: "desiredRelief",
      title: "Requested relief",
      empty: "No relief notes yet.",
      placeholder: "Client wants...",
    },
  ];

  const updateFactSheetBullet = (sectionKey, index, value) => {
    setFactSheetDraft((current) => ({
      ...current,
      [sectionKey]: ensureDraftList(current[sectionKey]).map((item, itemIndex) =>
        itemIndex === index ? value : item
      ),
    }));
  };

  const addFactSheetBullet = (sectionKey) => {
    setFactSheetDraft((current) => ({
      ...current,
      [sectionKey]: [...ensureDraftList(current[sectionKey]), ""],
    }));
  };

  const removeFactSheetBullet = (sectionKey, index) => {
    setFactSheetDraft((current) => ({
      ...current,
      [sectionKey]: ensureDraftList(current[sectionKey]).filter(
        (_item, itemIndex) => itemIndex !== index
      ),
    }));
  };

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
          {hasDraftRows ? (
            <div className="space-y-3">
              {items.map((item, itemIndex) => (
                <div
                  key={`${section.key}-${itemIndex}`}
                  className="flex flex-col gap-3 sm:flex-row sm:items-start"
                >
                  <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80 sm:mt-3 sm:block" />
                  {canEditFactSheet ? (
                    <>
                      <AutoResizeTextarea
                        className="textarea textarea-bordered arena-textarea arena-field min-h-12 flex-1 resize-y text-sm leading-6 text-slate-100"
                        value={item}
                        onChange={(event) =>
                          updateFactSheetBullet(section.key, itemIndex, event.target.value)
                        }
                        placeholder={section.placeholder}
                      />
                      <button
                        type="button"
                        className="arena-btn-dark min-h-0 shrink-0 px-3 py-2 text-xs sm:self-start"
                        onClick={() => removeFactSheetBullet(section.key, itemIndex)}
                        aria-label={`Remove ${section.title} item`}
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <p className="flex-1 text-sm leading-7 text-white/78">{item}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 bg-black/15 p-4 text-sm text-white/42">
              {section.empty}
            </div>
          )}

          {canEditFactSheet ? (
            <button
              type="button"
              className="arena-btn-dark mt-3 min-h-0 px-3 py-2 text-xs"
              onClick={() => addFactSheetBullet(section.key)}
            >
              Add Item
            </button>
          ) : null}
        </div>
      </details>
    );
  };

  return (
    <main className="arena-app-shell min-h-screen overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-[1600px] space-y-6 arena-reveal">
        <div
          className="arena-surface arena-scanline arena-column-bg"
          style={heroPanelStyle}
        >
          <div className="p-4 sm:p-6 md:p-8">
            <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <p className="arena-kicker mb-4">LEGAL ARENA</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard"
                    className="arena-btn-dark inline-flex px-4 py-2 text-sm"
                  >
                    Back to Cases
                  </Link>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    {caseSession.practiceArea}
                  </span>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    {caseSession.primaryCategory}
                  </span>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    Complexity {caseSession.complexity}
                  </span>
                  <span className="badge badge-outline border-white/15 text-white/80">
                    {sideBadgeLabel}
                  </span>
                </div>
                <h1 className="arena-headline mt-5 max-w-5xl text-[2.35rem] uppercase leading-[0.95] sm:text-4xl md:text-6xl">
                  {caseSession.title}
                </h1>
                <p className="mt-4 max-w-3xl text-white/66">
                  {caseSession.premise.overview}
                </p>
                <div className="mt-6 grid gap-4 text-sm text-white/58 md:grid-cols-3">
                  <div>
                    <p className="arena-kicker">Plaintiff</p>
                    <p className="mt-2 text-base font-semibold text-white">{plaintiffName}</p>
                  </div>
                  <div>
                    <p className="arena-kicker">Defendant</p>
                    <p className="mt-2 text-base font-semibold text-white">{defendantName}</p>
                  </div>
                  <div>
                    <p className="arena-kicker">Court</p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {caseSession.premise.courtName}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 xl:items-end">
                <span
                  className={`badge border px-3 py-3 arena-status ${
                    statusTone[caseSession.status] || "arena-status-neutral"
                  }`}
                >
                  {isCourtroom ? courtroomRoundLabel : courtroomStageLabel}
                </span>
                <ButtonAccount />
                <div className="arena-surface-soft w-full p-4 text-sm text-white/60 xl:max-w-[18rem]">
                  {isCourtroom ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 3v18m0-18 7.5 4.5M12 3 4.5 7.5M19.5 7.5v9L12 21m7.5-13.5L12 12m0 9-7.5-4.5v-9M12 12 4.5 7.5"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="arena-kicker">You Represent</p>
                        <p className="mt-1 font-semibold text-white">{playerPartyName}</p>
                        <p className="text-sm text-white/55">{sideBadgeLabel.replace(" Side", "")}</p>
                      </div>
                    </div>
                  ) : (
                    <p>
                      You represent <span className="text-white">{playerPartyName}</span> against{" "}
                      <span className="text-white">{opponentPartyName}</span>.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="min-w-0 space-y-6">
            {isInterview ? (
              <div className="arena-surface">
                <div className="p-4 sm:p-6">
                  <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div>
                      <p className="arena-kicker">Step 1</p>
                      <h2 className="arena-headline mt-2 text-2xl">
                        Collect your side&apos;s facts
                      </h2>
                      <p className="mt-3 text-sm text-white/62">
                        Interview {playerPartyName} and tighten the record.
                      </p>
                    </div>
                    <div className="arena-surface-soft min-w-0 p-4">
                      <p className="arena-kicker">Tip</p>
                      <p className="mt-3 break-words text-sm leading-7 text-white/68">
                        Ask clear, open-ended questions about dates, records, witnesses, notice,
                        and any gaps in proof.
                      </p>
                    </div>
                  </div>

                  <div
                    ref={interviewTranscriptRef}
                    className="arena-scroll mt-5 max-h-[24rem] space-y-4 overflow-y-auto pr-1 sm:max-h-[26rem] sm:pr-2"
                  >
                    {visibleInterviewTranscript.map((entry, index) => (
                      <article
                        key={`${entry.createdAt}-${index}`}
                        className={`min-w-0 max-w-full rounded-xl border p-4 ${
                          entry.role !== "player"
                            ? "arena-transcript-opponent border-amber-500/30"
                            : "arena-transcript-player sm:ml-auto sm:max-w-[90%] border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">
                            {entry.role !== "player"
                              ? `Interview: ${entry.speaker}`
                              : entry.speaker}
                          </p>
                          <p className="text-xs text-white/40">
                            {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-white">
                          {entry.text}
                        </p>
                      </article>
                    ))}
                    {working && pendingSpeaker && (
                      <article className="arena-transcript-opponent arena-reveal max-w-[90%] rounded-xl border border-amber-500/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{pendingSpeaker}</p>
                          <p className="text-xs text-white/40">typing</p>
                        </div>
                        <p className="mt-2 leading-7 text-white/88">
                          {pendingSpeaker} is answering...
                        </p>
                        <TypingIndicator speaker={pendingSpeaker} />
                      </article>
                    )}
                  </div>

                  <form className="mt-6 min-w-0 space-y-4" onSubmit={handleInterviewSubmit}>
                    <textarea
                      className="textarea textarea-bordered arena-textarea arena-field h-28 min-w-0 w-full text-slate-100"
                      placeholder={`Ask ${playerPartyName} about dates, records, witnesses, notice, or any proof gaps you need to pin down.`}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={handleChatTextareaKeyDown}
                      disabled={transcribingQuestion}
                    />
                    <div className="flex items-center justify-end text-xs uppercase tracking-[0.14em] text-white/38">
                      {question.trim().length} / 500
                    </div>
                    {suggestedQuestions.length > 0 ? (
                      <div>
                        <p className="text-sm text-white/62">Suggested open questions:</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {suggestedQuestions.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                              onClick={() => setQuestion(item)}
                            >
                              + {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <button
                        type="button"
                        className={`w-full justify-center border sm:w-auto ${
                          recordingQuestion ? "arena-btn-danger" : "arena-btn-dark"
                        } inline-flex items-center gap-2 px-4 py-3`}
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
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="h-5 w-5"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-12 0v1.5a6 6 0 0 0 6 6Zm0 0v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V6a3 3 0 1 1 6 0v6.75a3 3 0 0 1-3 3Z"
                            />
                          </svg>
                        )}
                        {recordingQuestion ? (
                          <VoiceWaveform level={questionAudioLevel} />
                        ) : null}
                        {recordingQuestion
                          ? "Stop Voice Input"
                          : transcribingQuestion
                          ? "Transcribing"
                          : "Voice Input"}
                      </button>
                      <button
                        className="arena-btn-light w-full px-6 py-3 sm:w-auto"
                        disabled={working || recordingQuestion || transcribingQuestion}
                      >
                        {pendingAction === "interview"
                          ? "Continuing Intake..."
                          : "Continue Intake"}
                      </button>
                      <button
                        type="button"
                        className="arena-btn-danger w-full px-4 py-3 sm:ml-auto sm:w-auto"
                        disabled={working || recordingQuestion || transcribingQuestion}
                        onClick={handleExitCase}
                      >
                        {pendingAction === "exit"
                          ? apiConfig.exitPendingLabel || "Exiting..."
                          : apiConfig.exitLabel || "Exit Case"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
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
              <div className="arena-surface arena-round-transition">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="arena-kicker">Step 2</p>
                      <h2 className="arena-headline mt-2 text-2xl">
                        Freeform courtroom duel
                      </h2>
                      <p className="mt-3 text-sm text-white/62">
                        Deliver your argument to the court.
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.14em] text-white/42">
                      Round {caseSession.score.roundsCompleted + 1} of {caseSession.maxCourtRounds}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="arena-stat-card">
                      <div className="flex items-center gap-2">
                        <p className="arena-kicker">Your Pressure</p>
                        <InfoDot
                          content={helpText.playerPressure}
                          label="Explain your pressure"
                        />
                      </div>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {caseSession.score.player}
                        <span className="ml-1 text-sm font-medium text-white/42">/ 100</span>
                      </p>
                      <div className="mt-3 arena-progress-track" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300"
                          style={{ width: `${playerPressurePct}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-white/62">
                        Build pressure with strong facts and clear arguments.
                      </p>
                    </div>
                    <div className="arena-stat-card">
                      <div className="flex items-center gap-2">
                        <p className="arena-kicker">Opponent Pressure</p>
                        <InfoDot
                          content={helpText.opponentPressure}
                          label="Explain opponent pressure"
                        />
                      </div>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {caseSession.score.opponent}
                        <span className="ml-1 text-sm font-medium text-white/42">/ 100</span>
                      </p>
                      <div className="mt-3 arena-progress-track" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                          style={{ width: `${opponentPressurePct}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-white/62">
                        Weaker arguments increase opponent pressure.
                      </p>
                    </div>
                    <div className="arena-stat-card">
                      <p className="arena-kicker">Bench Signal</p>
                      <p className="mt-2 text-sm leading-7 text-white/76">
                        {caseSession.score.lastBenchSignal ||
                          "The bench is listening. Build the record carefully."}
                      </p>
                    </div>
                  </div>

                  <div
                    ref={courtroomTranscriptRef}
                    className="arena-scroll mt-5 max-h-[26rem] space-y-4 overflow-y-auto pr-1 sm:max-h-[30rem] sm:pr-2"
                  >
                    {normalizedCourtroomTranscript.length === 0 ? (
                      <div className="arena-surface-soft min-w-0 p-5">
                        <p className="font-semibold text-white">Court is now in session.</p>
                        <p className="mt-2 text-sm text-white/62">
                          Open with your strongest theory and anchor it to lawbook and fact
                          sheet.
                        </p>
                      </div>
                    ) : (
                      normalizedCourtroomTranscript.map((entry, index) => (
                        <article
                          key={`${entry.round}-${entry.speaker}-${index}`}
                          className={`min-w-0 max-w-full rounded-xl p-4 ${
                            entry.speaker === "player"
                              ? "arena-transcript-player sm:ml-auto sm:max-w-[95%]"
                              : "arena-transcript-opponent"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-white">
                              {entry.speaker === "player" ? "You" : opponentPartyName}
                            </p>
                            <p className="text-xs text-white/40">Round {entry.round}</p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-white">
                            {entry.text}
                          </p>
                          {entry.speaker === "player" &&
                            (entry.citedFacts.length > 0 ||
                              entry.citedRules.length > 0) && (
                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                {entry.citedFacts.map((fact, factIndex) => {
                                  const resolvedFact = resolveFactReference(
                                    fact,
                                    canonicalFactLookup
                                  );

                                  return (
                                    <span
                                      key={`${fact}-${factIndex}`}
                                      className="badge badge-outline badge-sm max-w-[18rem] truncate border-white/15 text-white/82"
                                      data-tooltip-id="tooltip"
                                      data-tooltip-content={resolvedFact.tooltip}
                                    >
                                      {resolvedFact.badge}
                                    </span>
                                  );
                                })}
                                {entry.citedRules.map((rule) => (
                                  <span
                                    key={rule}
                                    className="badge badge-sm arena-status arena-status-caution border"
                                    data-tooltip-id="tooltip"
                                    data-tooltip-content={getRuleTooltip(rule)}
                                  >
                                    {rule}
                                  </span>
                                ))}
                              </div>
                            )}
                        </article>
                      ))
                    )}
                    {working && pendingSpeaker === opponentPartyName && (
                      <article className="arena-transcript-opponent rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{opponentPartyName}</p>
                          <p className="text-xs uppercase tracking-[0.14em] text-amber-100/46">
                            Preparing
                          </p>
                        </div>
                        <p className="mt-2 leading-7 text-white">
                          {opponentPartyName} is preparing a response...
                        </p>
                        <div className="mt-4">
                          <LoadingBar label={`${opponentPartyName} is preparing a response`} />
                        </div>
                      </article>
                    )}
                  </div>

                  {!isVerdict && waitingForPlaintiffOpening ? (
                    <div className="arena-surface-soft mt-6 p-4 text-sm leading-6 text-white/68">
                      You are waiting for the plaintiff&apos;s opening statement. Once it is
                      filed, you can respond for the defense.
                    </div>
                  ) : null}

                  {!isVerdict && !viewerSubmittedCurrentRound && !waitingForPlaintiffOpening && (
                    <form className="mt-6 min-w-0 space-y-4" onSubmit={handleCourtroomSubmit}>
                      <div>
                        <p className="arena-kicker">Your Argument</p>
                        <p className="mt-2 text-sm text-white/52">
                          Deliver your argument for {playerPartyName}. Cite the fact sheet,
                          confront the weakest point on {opponentPartyName}&apos;s side, and tie
                          your position to the law.
                        </p>
                      </div>
                      <textarea
                        className="textarea textarea-bordered arena-textarea arena-field h-40 min-w-0 w-full text-slate-100"
                        placeholder={`Deliver your argument for ${playerPartyName}. Cite the fact sheet, confront the weakest point on ${opponentPartyName}'s side, and tie your position to the lawbook.`}
                        value={argument}
                        onChange={(event) => setArgument(event.target.value)}
                        onKeyDown={handleChatTextareaKeyDown}
                        disabled={transcribingArgument}
                      />
                      <div className="flex items-center justify-end text-xs uppercase tracking-[0.14em] text-white/38">
                        {argument.trim().length} / 2500
                      </div>
                      {argumentQuickTools.length ? (
                        <div>
                          <p className="arena-kicker">Quick Tools</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {argumentQuickTools.map(([label, snippet]) => (
                              <button
                                key={label}
                                type="button"
                                className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                                onClick={() => appendArgumentSnippet(snippet)}
                              >
                                {label}
                              </button>
                            ))}
                            {argument.trim() ? (
                              <button
                                type="button"
                                className="arena-btn-dark min-h-0 px-3 py-2 text-sm"
                                onClick={() => setArgument("")}
                              >
                                Clear draft
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                          type="button"
                          className={`w-full justify-center border sm:w-auto ${
                            recordingArgument
                              ? "arena-btn-danger"
                              : "arena-btn-dark"
                          } inline-flex items-center gap-2 px-4 py-3`}
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
                          {transcribingArgument ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                              className="h-5 w-5"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 18.75a6 6 0 0 0 6-6v-1.5m-12 0v1.5a6 6 0 0 0 6 6Zm0 0v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V6a3 3 0 1 1 6 0v6.75a3 3 0 0 1-3 3Z"
                              />
                            </svg>
                          )}
                          {recordingArgument ? (
                            <VoiceWaveform level={argumentAudioLevel} />
                          ) : null}
                          {recordingArgument
                            ? "Stop"
                            : transcribingArgument
                            ? "Transcribing"
                            : "Voice Argument"}
                        </button>
                        <button
                          className="arena-btn-light w-full px-5 py-3 sm:ml-auto sm:w-auto"
                          disabled={working || recordingArgument || transcribingArgument}
                        >
                          {pendingAction === "courtroom"
                            ? "Submitting..."
                            : "Submit Argument"}
                        </button>
                      </div>
                      <div className="arena-surface-soft flex items-start gap-3 p-4 text-sm text-white/62">
                        <span className="text-amber-300">Tip:</span>
                        <p>Strong arguments are clear, concise, and backed by facts.</p>
                      </div>
                    </form>
                  )}
                  {!isVerdict && viewerSubmittedCurrentRound ? (
                    <article className="arena-transcript-opponent mt-6 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">{opponentPartyName}</p>
                        <p className="text-xs uppercase tracking-[0.14em] text-amber-100/46">
                          Preparing
                        </p>
                      </div>
                      <p className="mt-2 leading-7 text-white">
                        Your argument is filed. {opponentPartyName} is preparing a response.
                      </p>
                      <TypingIndicator speaker={opponentPartyName} />
                      <div className="mt-4">
                        <LoadingBar label={`${opponentPartyName} is preparing a response`} />
                      </div>
                    </article>
                  ) : null}
                </div>
              </div>
            )}

            {(isInterview || isCourtroom) && renderLawbookPanel("hidden xl:block")}

            {isVerdict && (
              <div className={`arena-surface border ${verdictStyle.card}`}>
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className={`arena-kicker ${verdictStyle.eyebrow}`}>Final Ruling</p>
                      <span className={`badge border arena-status ${verdictStyle.card}`}>
                        {winnerSignal[caseSession.verdict.winner] || winnerSignal.draw}
                      </span>
                    </div>
                    <Link href="/dashboard" className="arena-btn-light inline-flex px-5 py-3 text-sm">
                      Back to Cases
                    </Link>
                  </div>
                  <h2 className="arena-headline mt-2 text-3xl uppercase">
                    {winnerLabel[caseSession.verdict.winner]}
                  </h2>
                  <p className="mt-3 max-w-3xl leading-7 text-white/66">
                    {caseSession.verdict.summary}
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="arena-surface-soft p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">What helped your side</p>
                        <InfoDot
                          content={helpText.helpedYourSide}
                          label="Explain what helped your side"
                        />
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-white/66">
                        {caseSession.verdict.highlights.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="arena-surface-soft p-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">What weakened your side</p>
                        <InfoDot
                          content={helpText.weakenedYourSide}
                          label="Explain what weakened your side"
                        />
                      </div>
                      <ul className="mt-3 space-y-2 text-sm text-white/66">
                        {caseSession.verdict.concerns.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="min-w-0 space-y-6">
            {workspaceNotice}
            <div className="arena-surface">
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
              <div className="arena-surface">
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
          {(isInterview || isCourtroom) && renderLawbookPanel("xl:hidden")}
        </div>
      </section>
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
