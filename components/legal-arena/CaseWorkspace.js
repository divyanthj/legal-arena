"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tooltip } from "react-tooltip";
import ButtonAccount from "@/components/ButtonAccount";
import apiClient from "@/libs/api";
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

export default function CaseWorkspace({ initialCase }) {
  const router = useRouter();
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
  const [optimisticTranscriptEntry, setOptimisticTranscriptEntry] = useState(null);
  const interviewTranscriptRef = useRef(null);
  const courtroomTranscriptRef = useRef(null);
  const {
    recordingQuestion,
    transcribingQuestion,
    recordingArgument,
    transcribingArgument,
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

  const handleChatTextareaKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent?.isComposing) {
      return;
    }

    event.preventDefault();

    if (working) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  };

  const handleInterviewSubmit = async (event) => {
    event.preventDefault();
    if (working || !question.trim()) return;

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
      const { caseSession: nextCase } = await apiClient.post(
        `/cases/${getCaseRouteRef(caseSession)}/interview`,
        { question: submittedQuestion }
      );

      setCaseSession({
        ...nextCase,
        factSheet: sanitizeFactSheet(nextCase.factSheet || {}),
      });
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
    setWorking(true);
    setPendingAction("finalize");

    try {
      const { caseSession: nextCase } = await apiClient.post(
        `/cases/${getCaseRouteRef(caseSession)}/finalize`,
        {
          factSheet: buildFactSheetPayload(),
        }
      );

      setCaseSession({
        ...nextCase,
        factSheet: sanitizeFactSheet(nextCase.factSheet || {}),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setPendingAction("");
      setWorking(false);
    }
  };

  const handleCourtroomSubmit = async (event) => {
    event.preventDefault();
    if (working || !argument.trim()) return;

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
    setPendingSpeaker(getOpponentPartyName(caseSession));

    try {
      const { caseSession: nextCase } = await apiClient.post(
        `/cases/${getCaseRouteRef(caseSession)}/courtroom`,
        { argument: submittedArgument }
      );

      setCaseSession({
        ...nextCase,
        factSheet: sanitizeFactSheet(nextCase.factSheet || {}),
      });
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
      "Exit this case? You will not be able to start the same case again for 24 hours."
    );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setPendingAction("exit");

    try {
      await apiClient.post(`/cases/${getCaseRouteRef(caseSession)}/exit`);
      router.push("/dashboard");
      router.refresh();
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
    const rule = caseSession.lawbook[0];

    return [
      `May it please the Court. I represent ${playerPartyName}.`,
      theory ? `Our position is straightforward: ${theory}` : "",
      strongestFact ? `The record starts with this point: ${strongestFact}` : "",
      rule ? `The governing lens is ${rule.title}: ${rule.principle}` : "",
      liveRisk ? `I also want to address the main weakness directly: ${liveRisk}` : "",
      relief ? `For that reason, ${playerPartyName} asks for ${relief}` : "",
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
    const rule = caseSession.lawbook[0];

    return rule ? `Under ${rule.title}, ${rule.principle}` : "";
  };

  const argumentQuickTools = [
    ["Opening statement", openingStatementSnippet()],
    ["Add strongest fact", strongestFactSnippet()],
    ["Address risk", riskResponseSnippet()],
    ["Handle proof gap", proofGapSnippet()],
    ["Cite lawbook", lawbookSnippet()],
  ].filter((tool) => tool[1]);

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
                <div key={`${section.key}-${itemIndex}`} className="flex items-start gap-3">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" />
                  {isInterview ? (
                    <>
                      <textarea
                        className="textarea textarea-bordered arena-textarea arena-field min-h-12 flex-1 resize-none text-sm leading-6 text-slate-100"
                        value={item}
                        onChange={(event) =>
                          updateFactSheetBullet(section.key, itemIndex, event.target.value)
                        }
                        placeholder={section.placeholder}
                      />
                      <button
                        type="button"
                        className="arena-btn-dark min-h-0 shrink-0 px-3 py-2 text-xs"
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

          {isInterview ? (
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
    <main className="arena-app-shell min-h-screen px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-[1600px] space-y-6 arena-reveal">
        <div
          className="arena-surface arena-scanline arena-column-bg"
          style={heroPanelStyle}
        >
          <div className="p-6 md:p-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
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
                <h1 className="arena-headline mt-5 max-w-5xl text-4xl uppercase leading-[0.92] md:text-6xl">
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

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            {isInterview ? (
              <div className="arena-surface">
                <div className="p-6">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div>
                      <p className="arena-kicker">Step 1</p>
                      <h2 className="arena-headline mt-2 text-2xl">
                        Collect your side&apos;s facts
                      </h2>
                      <p className="mt-3 text-sm text-white/62">
                        Interview {playerPartyName} and tighten the record.
                      </p>
                    </div>
                    <div className="arena-surface-soft p-4">
                      <p className="arena-kicker">Tip</p>
                      <p className="mt-3 text-sm leading-7 text-white/68">
                        Ask clear, open-ended questions about dates, records, witnesses, notice,
                        and any gaps in proof.
                      </p>
                    </div>
                  </div>

                  <div
                    ref={interviewTranscriptRef}
                    className="arena-scroll mt-5 max-h-[26rem] space-y-4 overflow-y-auto pr-2"
                  >
                    {visibleInterviewTranscript.map((entry, index) => (
                      <article
                        key={`${entry.createdAt}-${index}`}
                        className={`rounded-xl border p-4 ${
                          entry.role !== "player"
                            ? "arena-transcript-opponent border-amber-500/30"
                            : "arena-transcript-player ml-auto max-w-[90%] border-white/10"
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
                        <p className="mt-2 whitespace-pre-wrap leading-7 text-white">
                          {entry.text}
                        </p>
                      </article>
                    ))}
                    {working && pendingSpeaker && (
                      <article className="arena-transcript-opponent rounded-xl border border-amber-500/30 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{pendingSpeaker}</p>
                          <p className="text-xs uppercase tracking-[0.14em] text-amber-100/46">
                            Thinking
                          </p>
                        </div>
                        <p className="mt-2 leading-7 text-white">
                          {pendingSpeaker} is answering...
                        </p>
                        <div className="mt-4">
                          <LoadingBar label={`${pendingSpeaker} is answering`} />
                        </div>
                      </article>
                    )}
                  </div>

                  <form className="mt-6 space-y-4" onSubmit={handleInterviewSubmit}>
                    <textarea
                      className="textarea textarea-bordered arena-textarea arena-field h-28 w-full text-slate-100"
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
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className={`border ${
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
                        {recordingQuestion
                          ? "Stop Voice Interview"
                          : transcribingQuestion
                          ? "Transcribing"
                          : "Voice Interview"}
                      </button>
                      <button
                        className="arena-btn-light px-6 py-3"
                        disabled={working || recordingQuestion || transcribingQuestion}
                      >
                        {pendingAction === "interview"
                          ? "Continuing Intake..."
                          : "Continue Intake"}
                      </button>
                      <button
                        type="button"
                        className="arena-btn-danger ml-auto px-4 py-3"
                        disabled={working || recordingQuestion || transcribingQuestion}
                        onClick={handleExitCase}
                      >
                        {pendingAction === "exit" ? "Exiting..." : "Exit Case"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : isExited ? (
              <div className="arena-surface">
                <div className="p-6">
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
                <div className="p-6">
                  <div className="flex items-end justify-between gap-3">
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

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
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
                    className="arena-scroll mt-5 max-h-[30rem] space-y-4 overflow-y-auto pr-2"
                  >
                    {normalizedCourtroomTranscript.length === 0 ? (
                      <div className="arena-surface-soft p-5">
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
                          className={`rounded-xl p-4 ${
                            entry.speaker === "player"
                              ? "arena-transcript-player ml-auto max-w-[95%]"
                              : "arena-transcript-opponent"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-white">
                              {entry.speaker === "player" ? "You" : opponentPartyName}
                            </p>
                            <p className="text-xs text-white/40">Round {entry.round}</p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap leading-7 text-white">
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

                  {!isVerdict && (
                    <form className="mt-6 space-y-4" onSubmit={handleCourtroomSubmit}>
                      <div>
                        <p className="arena-kicker">Your Argument</p>
                        <p className="mt-2 text-sm text-white/52">
                          Deliver your argument for {playerPartyName}. Cite the fact sheet,
                          confront the weakest point on {opponentPartyName}&apos;s side, and tie
                          your position to the law.
                        </p>
                      </div>
                      <textarea
                        className="textarea textarea-bordered arena-textarea arena-field h-40 w-full text-slate-100"
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
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className={`border ${
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
                          {recordingArgument
                            ? "Stop"
                            : transcribingArgument
                            ? "Transcribing"
                            : "Voice Argument"}
                        </button>
                        <button
                          className="arena-btn-light ml-auto px-5 py-3"
                          disabled={working || recordingArgument || transcribingArgument}
                        >
                          {pendingAction === "courtroom"
                            ? "Submitting Argument..."
                            : "Submit Argument"}
                        </button>
                      </div>
                      <div className="arena-surface-soft flex items-start gap-3 p-4 text-sm text-white/62">
                        <span className="text-amber-300">Tip:</span>
                        <p>Strong arguments are clear, concise, and backed by facts.</p>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {(isInterview || isCourtroom) && (
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
                          {caseSession.lawbook.length} rules active
                        </span>
                        <CollapseChevron />
                      </div>
                    </div>
                  </summary>
                  <div className="px-6 pb-6">
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                      {caseSession.lawbook.map((rule) => (
                        <article
                          key={rule.id}
                          className="arena-surface-soft flex min-h-[17rem] flex-col p-4"
                        >
                          <p className="font-semibold text-white">{rule.title}</p>
                          <p className="mt-3 flex-1 text-sm leading-6 text-white/66">
                            {rule.principle}
                          </p>
                          <p className="mt-4 text-xs uppercase tracking-[0.15em] text-white/40">
                            {rule.tags.join(" | ")}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            )}

            {isVerdict && (
              <div className={`arena-surface border ${verdictStyle.card}`}>
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className={`arena-kicker ${verdictStyle.eyebrow}`}>Final Ruling</p>
                    <span className={`badge border arena-status ${verdictStyle.card}`}>
                      {winnerSignal[caseSession.verdict.winner] || winnerSignal.draw}
                    </span>
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

          <aside className="space-y-6">
            <div className="arena-surface">
              <div className="p-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="arena-kicker">Fact Sheet</p>
                    <h2 className="arena-headline mt-2 text-2xl">Case file</h2>
                  </div>
                  <div className="flex flex-col items-end gap-2">
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
                      <button
                        className="arena-btn-light w-full px-5 py-3"
                        onClick={handleFinalize}
                        disabled={working}
                      >
                        {pendingAction === "finalize"
                          ? "Finalizing Fact Sheet..."
                          : "Finalize Fact Sheet"}
                      </button>
                      {pendingAction === "finalize" ? (
                        <LoadingBar label="Finalizing fact sheet" />
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isInterview ? (
              <>
                <div className="arena-surface">
                  <div className="p-6">
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
                      <div className="radial-progress text-white" style={{ "--value": roundedFactSheetProgressPercent, "--size": "5rem", "--thickness": "0.5rem" }}>
                        {roundedFactSheetProgressPercent}%
                      </div>
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
                  <div className="p-6">
                    <p className="arena-kicker">Case Quick Links</p>
                    <div className="mt-5 space-y-3">
                      <a
                        href="#"
                        className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72"
                      >
                        <span>Case details</span>
                        <span className="text-white/35">{caseSession.premise.courtName}</span>
                      </a>
                      <a
                        href="#"
                        className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72"
                      >
                        <span>Opponent</span>
                        <span className="text-white/35">{opponentPartyName}</span>
                      </a>
                      <a
                        href="#"
                        className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/72"
                      >
                        <span>Public case feed</span>
                        <span className="text-white/35">{caseSession.primaryCategory}</span>
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
                      <CollapseChevron />
                    </div>
                  </summary>
                  <div className="px-6 pb-6">
                    <div className="space-y-3">
                      {caseSession.lawbook.map((rule) => (
                        <article key={rule.id} className="arena-surface-soft p-4">
                          <p className="font-semibold text-white">{rule.title}</p>
                          <p className="mt-2 text-sm leading-6 text-white/66">
                            {rule.principle}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.15em] text-white/40">
                            {rule.tags.join(" | ")}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            )}
          </aside>
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
