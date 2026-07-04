import "server-only";

import { requestStructuredCompletion } from "@/libs/gpt";
import {
  DEFAULT_CATEGORY_SLUG,
  getCategoryBySlug,
  getCategoryTitle,
} from "./categories";

const DYNAMIC_CASE_MODEL =
  process.env.OPENAI_DYNAMIC_CASE_MODEL?.trim() ||
  process.env.OPENAI_GENERATION_MODEL?.trim() ||
  process.env.OPENAI_MODEL?.trim() ||
  "gpt-5.4";

const clampComplexity = (value = 1) =>
  Math.max(1, Math.min(5, Number(value) || 1));

const getPlayabilityProfile = (complexity = 1, playerLevel = 1) => {
  const normalizedComplexity = clampComplexity(complexity);
  const level = Math.max(1, Number(playerLevel) || 1);
  const profiles = {
    1: {
      label: "intro",
      issueBudget: 1,
      evidenceBudget: 3,
      storyLength: "short",
      guidance:
        "Make this friendly for a non-lawyer: one central dispute, obvious goals, clear records, and one manageable weakness per side.",
    },
    2: {
      label: "beginner",
      issueBudget: 2,
      evidenceBudget: 4,
      storyLength: "compact",
      guidance:
        "Keep this playable for a smart beginner: two connected issues, plain-language facts, and no procedural traps.",
    },
    3: {
      label: "intermediate",
      issueBudget: 3,
      evidenceBudget: 6,
      storyLength: "moderate",
      guidance:
        "Use a moderate case with a few live disputes, but keep the path to a decent argument visible.",
    },
    4: {
      label: "advanced",
      issueBudget: 4,
      evidenceBudget: 8,
      storyLength: "layered",
      guidance:
        "Use layered facts and proof tensions, but avoid overwhelming issue sprawl.",
    },
    5: {
      label: "expert",
      issueBudget: 5,
      evidenceBudget: 10,
      storyLength: "dense",
      guidance:
        "Use a sophisticated dispute with multiple proof and credibility tensions.",
    },
  };

  return {
    ...profiles[normalizedComplexity],
    playerLevel: level,
    complexity: normalizedComplexity,
  };
};

const cleanText = (value = "") => String(value || "").trim();

const cleanList = (items = [], limit = 8) =>
  (Array.isArray(items) ? items : [])
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, limit);

const slugify = (value = "") =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const normalizeSideProfile = (profile = {}) => ({
  communicationStyle:
    cleanText(profile.communicationStyle) || "plain",
  honesty: Math.max(0, Math.min(1, Number(profile.honesty ?? 0.7))),
  memoryDiscipline: Math.max(0, Math.min(1, Number(profile.memoryDiscipline ?? 0.55))),
  emotionalControl: Math.max(0, Math.min(1, Number(profile.emotionalControl ?? 0.55))),
  backgroundNotes: cleanList(profile.backgroundNotes, 4),
});

const normalizeEvidence = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const label = cleanText(item?.label) || `Evidence ${index + 1}`;
      const id = slugify(item?.id || label) || `evidence-${index + 1}`;

      return {
        id,
        label,
        detail: cleanText(item?.detail || item?.description),
        type: cleanText(item?.type) || "document",
        owner: cleanText(item?.owner) || cleanText(item?.holderSide) || "unknown",
        accessibility: cleanText(item?.accessibility) || "discoverable",
        strength: cleanText(item?.strength) || "ambiguous",
        supportsSide: cleanText(item?.supportsSide) || "unknown",
        evidenceQuality: cleanText(item?.evidenceQuality || item?.quality),
        contradiction: cleanText(item?.contradiction || item?.contradicts),
        availableAtStart: Boolean(item?.availableAtStart),
      };
    })
    .filter((item) => item.detail)
    .slice(0, 12);

const fallbackDynamicCase = ({ categorySlug, complexity }) => {
  const category = getCategoryBySlug(categorySlug) || getCategoryBySlug(DEFAULT_CATEGORY_SLUG);
  const categoryTitle = category?.title || getCategoryTitle(categorySlug);
  const normalizedComplexity = clampComplexity(complexity);
  const isRental = category?.slug === "rental-dispute";

  return {
    title: isRental ? "Deposit Deadline Dispute" : `${categoryTitle} Pressure Case`,
    shortDescription: isRental
      ? "A tenant says a landlord kept most of a deposit after a rushed move-out."
      : "Two sides disagree over performance, payment, records, and who created the loss.",
    courtName: isRental ? "Civic Claims Court" : "County Civil Court",
    practiceArea: categoryTitle,
    primaryCategory: category?.slug || DEFAULT_CATEGORY_SLUG,
    complexity: normalizedComplexity,
    plaintiffName: isRental ? "Nora Patel" : "Avery Morgan",
    defendantName: isRental ? "Harbor Gate Rentals" : "Northline Services",
    coreDispute: isRental
      ? "Whether the landlord can justify deposit deductions with records instead of vague turnover charges."
      : "Whether the plaintiff can prove the defendant breached the deal and caused the claimed loss.",
    dramaticQuestion: isRental
      ? "Did the landlord document real damage, or is this ordinary turnover dressed up as deductions?"
      : "Who has the better records, and who is overclaiming what the agreement required?",
    desiredRelief: isRental
      ? "Return of the withheld deposit plus filing costs."
      : "Payment of the claimed balance plus filing costs.",
    defendantObjective: isRental
      ? "Deny or reduce the deposit refund because the charges were reasonable."
      : "Deny or reduce the claimed balance because performance and causation are disputed.",
    plaintiffStory:
      isRental
        ? "I moved out on time, cleaned the unit, and expected most of my deposit back. The landlord first sent a vague message about cleaning and wall repairs, then later produced a generic invoice that does not clearly tie the charges to my unit. I remember taking a few photos, but I am not sure they show every room. I mainly want the withheld money returned because the deductions feel inflated and unsupported."
        : "I did what the agreement required and sent the final deliverables, but the other side kept asking for more while refusing to pay the balance. I have some emails and files showing delivery, though the scope was not as buttoned up as I wish. The other side is now acting as if every revision was a condition of payment.",
    defendantStory:
      isRental
        ? "The unit needed more turnover work than an ordinary cleaning. The tenant left marks and delayed returning clear documentation, and our manager approved the deductions after reviewing the unit. The invoice is not very detailed, but the charges were real and the tenant is minimizing the condition problems."
        : "The work was incomplete, late, and not useful without additional corrections. We did not refuse to pay for no reason; we disputed whether the final milestone was ever actually met. Some messages praised early drafts, but that was before the problems became clear.",
    plaintiffOpeningStatement: isRental
      ? "I moved out on time and the landlord kept most of my deposit with only vague explanations. I want to know what they can actually prove."
      : "I delivered the work and the other side used delay and revision complaints to avoid paying what they owed.",
    defendantOpeningStatement: isRental
      ? "The tenant is leaving out the condition issues we had to address after move-out. The deductions were not random."
      : "The plaintiff is skipping over the unfinished work and pretending every draft was final delivery.",
    legalIssues: isRental
      ? ["deposit deductions", "ordinary wear", "itemization", "proof of actual costs"]
      : ["contract performance", "acceptance", "payment condition", "causation"],
    discoveryRules: [
      "Resolve requested records only when the player asks a targeted question.",
      "Keep each resolved answer stable after it appears in the transcript.",
    ],
    evidencePool: [
      {
        label: isRental ? "Generic turnover invoice" : "Final delivery email",
        detail: isRental
          ? "A one-line turnover invoice exists, but it does not clearly separate cleaning from wall repair."
          : "An email shows files were sent, but the wording leaves room to argue they were draft deliverables.",
        type: isRental ? "invoice" : "email",
        owner: isRental ? "defendant" : "plaintiff",
        accessibility: "discoverable",
        strength: "moderate",
        supportsSide: isRental ? "defendant" : "plaintiff",
      },
      {
        label: isRental ? "Move-out photos" : "Revision thread",
        detail: isRental
          ? "A few move-out photos show clean counters and floors, but not every disputed area."
          : "Messages show the defendant asked for changes after praising earlier work.",
        type: isRental ? "photo" : "message",
        owner: "plaintiff",
        accessibility: "discoverable",
        strength: "ambiguous",
        supportsSide: "plaintiff",
      },
    ],
    starterQuestions: {
      plaintiff: [
        "Walk me through the timeline from the last clear agreement to the dispute.",
        "What records do you personally have that show your side is right?",
        "What is the weakest thing the other side could say about your story?",
      ],
      defendant: [
        "What is the strongest reason your side says the plaintiff has not proven the claim?",
        "What records do you have that support your position?",
        "What fact worries you most if the judge focuses on proof?",
      ],
    },
    theorySeeds: {
      plaintiff: isRental
        ? "The deductions are unsupported and overstate ordinary turnover."
        : "The defendant accepted useful performance and is using revisions to avoid payment.",
      defendant: isRental
        ? "The plaintiff has not disproved reasonable, real turnover charges."
        : "The plaintiff has not proven final performance under the agreement.",
    },
    settlementLevers: ["Documentation risk", "Cost of proving every disputed item"],
    courtroomOpportunities: ["Tie relief to specific records", "Concede weak proof before narrowing the ask"],
    partyProfiles: {
      plaintiff: {
        communicationStyle: "plain",
        honesty: 0.72,
        memoryDiscipline: 0.58,
        emotionalControl: 0.48,
        backgroundNotes: ["Frustrated by the other side's paperwork gaps."],
      },
      defendant: {
        communicationStyle: "measured",
        honesty: 0.64,
        memoryDiscipline: 0.62,
        emotionalControl: 0.64,
        backgroundNotes: ["Confident in the position but thin on clean documentation."],
      },
    },
    generatedBy: "fallback",
  };
};

const normalizeDynamicCaseState = ({
  aiResult,
  categorySlug,
  complexity,
  playerLevel,
}) => {
  const fallback = fallbackDynamicCase({ categorySlug, complexity });
  const source = aiResult && typeof aiResult === "object" ? aiResult : {};
  const category = getCategoryBySlug(source.primaryCategory) ||
    getCategoryBySlug(categorySlug) ||
    getCategoryBySlug(DEFAULT_CATEGORY_SLUG);
  const primaryCategory = category?.slug || DEFAULT_CATEGORY_SLUG;
  const normalizedComplexity = clampComplexity(complexity);
  const playabilityProfile = getPlayabilityProfile(normalizedComplexity, playerLevel);
  const plaintiffName = cleanText(source.plaintiffName) || fallback.plaintiffName;
  const defendantName = cleanText(source.defendantName) || fallback.defendantName;

  return {
    generationMode: "dynamic",
    generatedAt: new Date().toISOString(),
    generatedBy: source.generatedBy || (aiResult ? "ai" : "fallback"),
    playabilityProfile,
    title: cleanText(source.title) || fallback.title,
    shortDescription: cleanText(source.shortDescription) || fallback.shortDescription,
    courtName: cleanText(source.courtName) || fallback.courtName,
    practiceArea: cleanText(source.practiceArea) || category?.title || fallback.practiceArea,
    primaryCategory,
    complexity: normalizedComplexity,
    plaintiffName,
    defendantName,
    clientName: plaintiffName,
    opponentName: defendantName,
    coreDispute: cleanText(source.coreDispute) || fallback.coreDispute,
    dramaticQuestion: cleanText(source.dramaticQuestion) || fallback.dramaticQuestion,
    desiredRelief: cleanText(source.desiredRelief) || fallback.desiredRelief,
    defendantObjective: cleanText(source.defendantObjective) || fallback.defendantObjective,
    plaintiffStory: cleanText(source.plaintiffStory) || fallback.plaintiffStory,
    defendantStory: cleanText(source.defendantStory) || fallback.defendantStory,
    plaintiffOpeningStatement:
      cleanText(source.plaintiffOpeningStatement) || fallback.plaintiffOpeningStatement,
    defendantOpeningStatement:
      cleanText(source.defendantOpeningStatement) || fallback.defendantOpeningStatement,
    legalIssues: cleanList(source.legalIssues, playabilityProfile.issueBudget + 1).length
      ? cleanList(source.legalIssues, playabilityProfile.issueBudget + 1)
      : cleanList(fallback.legalIssues, playabilityProfile.issueBudget + 1),
    discoveryRules: cleanList(source.discoveryRules, 8).length
      ? cleanList(source.discoveryRules, 8)
      : fallback.discoveryRules,
    factGenerationRules: cleanList(source.factGenerationRules, 8),
    contradictionRules: cleanList(source.contradictionRules, 8),
    evidencePool: normalizeEvidence(source.evidencePool).length
      ? normalizeEvidence(source.evidencePool).slice(0, playabilityProfile.evidenceBudget)
      : normalizeEvidence(fallback.evidencePool).slice(0, playabilityProfile.evidenceBudget),
    starterQuestions: {
      plaintiff: cleanList(source.starterQuestions?.plaintiff, 4).length
        ? cleanList(source.starterQuestions.plaintiff, 4)
        : fallback.starterQuestions.plaintiff,
      defendant: cleanList(source.starterQuestions?.defendant, 4).length
        ? cleanList(source.starterQuestions.defendant, 4)
        : fallback.starterQuestions.defendant,
    },
    theorySeeds: {
      plaintiff: cleanText(source.theorySeeds?.plaintiff) || fallback.theorySeeds.plaintiff,
      defendant: cleanText(source.theorySeeds?.defendant) || fallback.theorySeeds.defendant,
    },
    settlementLevers: cleanList(source.settlementLevers, 6).length
      ? cleanList(source.settlementLevers, 6)
      : fallback.settlementLevers,
    courtroomOpportunities: cleanList(source.courtroomOpportunities, 6).length
      ? cleanList(source.courtroomOpportunities, 6)
      : fallback.courtroomOpportunities,
    partyProfiles: {
      plaintiff: normalizeSideProfile(source.partyProfiles?.plaintiff || fallback.partyProfiles.plaintiff),
      defendant: normalizeSideProfile(source.partyProfiles?.defendant || fallback.partyProfiles.defendant),
    },
  };
};

export const buildDynamicCaseTemplateSnapshot = (dynamicCase = {}) => ({
  id: "",
  slug: `dynamic-${slugify(dynamicCase.title || "generated-case")}-${Date.now()}`,
  title: dynamicCase.title,
  subtitle: dynamicCase.shortDescription,
  overview: dynamicCase.coreDispute || dynamicCase.shortDescription,
  desiredRelief: dynamicCase.desiredRelief,
  openingStatement: dynamicCase.plaintiffOpeningStatement,
  starterTheory: dynamicCase.theorySeeds?.plaintiff || "",
  practiceArea: dynamicCase.practiceArea,
  primaryCategory: dynamicCase.primaryCategory,
  secondaryCategories: [],
  complexity: dynamicCase.complexity,
  courtName: dynamicCase.courtName,
  plaintiffName: dynamicCase.plaintiffName,
  defendantName: dynamicCase.defendantName,
  clientName: dynamicCase.plaintiffName,
  opponentName: dynamicCase.defendantName,
  legalTags: dynamicCase.legalIssues || [],
  authoringNotes: "Dynamically generated session-level case state.",
  partyProfiles: dynamicCase.partyProfiles || {},
  interviewBlueprint: {
    plaintiff: {
      openingStatement: dynamicCase.plaintiffOpeningStatement,
      starterQuestions: dynamicCase.starterQuestions?.plaintiff || [],
      posture: dynamicCase.plaintiffStory,
    },
    defendant: {
      openingStatement: dynamicCase.defendantOpeningStatement,
      starterQuestions: dynamicCase.starterQuestions?.defendant || [],
      posture: dynamicCase.defendantStory,
    },
  },
  canonicalFacts: [],
  evidenceItems: [],
  dynamicCase,
  canonicalStory: {
    story: [dynamicCase.plaintiffStory, dynamicCase.defendantStory].filter(Boolean).join("\n\n"),
    events: [],
    partyMentalStates: {
      plaintiff: [dynamicCase.plaintiffStory].filter(Boolean),
      defendant: [dynamicCase.defendantStory].filter(Boolean),
    },
    evidenceNarrative: (dynamicCase.evidencePool || []).map((item) =>
      [item.label, item.detail].filter(Boolean).join(": ")
    ),
    ambiguities: [
      dynamicCase.dramaticQuestion,
      ...(dynamicCase.contradictionRules || []),
    ].filter(Boolean),
    authoringBoundaries: dynamicCase.discoveryRules || [],
  },
});

export const generateDynamicCaseState = async ({
  categorySlug = DEFAULT_CATEGORY_SLUG,
  complexity = 1,
  playerLevel = 1,
  userId = "system",
  onUsage,
} = {}) => {
  const category = getCategoryBySlug(categorySlug) || getCategoryBySlug(DEFAULT_CATEGORY_SLUG);
  const normalizedComplexity = clampComplexity(complexity);
  const normalizedPlayerLevel = Math.max(1, Number(playerLevel) || 1);
  const playabilityProfile = getPlayabilityProfile(
    normalizedComplexity,
    normalizedPlayerLevel
  );

  const aiResult = await requestStructuredCompletion({
    userId,
    model: DYNAMIC_CASE_MODEL,
    temperature: 0.85,
    maxTokens: 2600,
    retryAttempts: 1,
    usageLabel: "dynamicCase.generate",
    onUsage,
    systemPrompt:
      "You generate session-level legal disputes for a legal strategy game. Output valid JSON only. Do not create reusable templates or canonical fact lists.",
    userPrompt: JSON.stringify({
      task: "Generate one playable dynamic legal case initial state.",
      category: category?.slug || DEFAULT_CATEGORY_SLUG,
      categoryTitle: category?.title || "General",
      complexity: normalizedComplexity,
      playerLevel: normalizedPlayerLevel,
      playabilityProfile,
      designRules: [
        "Create plaintiff and defendant stories as subjective claims, not objective truth.",
        "Include contradictions, weaknesses, proof gaps, and tactical opportunities.",
        "Make intake discovery matter: at least one useful fact or artifact should require a sharp follow-up question.",
        "Do not generate canonicalFacts. Do not assume the judge knows secret truth.",
        "The case must produce a satisfying player move within five minutes.",
        "Honor the playabilityProfile strictly. Do not exceed its issueBudget or evidenceBudget.",
        "For intro and beginner cases, avoid expert procedural traps, dense counterclaims, medical causation, and multi-issue sprawl.",
        "For intro and beginner cases, use plain-language legal issues a non-lawyer can reason about from visible facts.",
        "The opponent should be beatable by a non-lawyer who asks sensible questions and makes plain arguments from visible facts.",
      ],
      outputSchema: {
        title: "string",
        shortDescription: "string",
        courtName: "string",
        practiceArea: "string",
        primaryCategory: "string",
        complexity: "number",
        plaintiffName: "string",
        defendantName: "string",
        coreDispute: "string",
        dramaticQuestion: "string",
        desiredRelief: "string",
        defendantObjective: "string",
        plaintiffStory: "string",
        defendantStory: "string",
        plaintiffOpeningStatement: "string",
        defendantOpeningStatement: "string",
        legalIssues: ["string"],
        discoveryRules: ["string"],
        factGenerationRules: ["string"],
        contradictionRules: ["string"],
        evidencePool: [
          {
            label: "string",
            detail: "string",
            type: "message|email|receipt|photo|invoice|contract|inspection|payment_record|witness|call_log|notice|screenshot|estimate|other",
            owner: "plaintiff|defendant|shared|third-party|unknown",
            accessibility: "available|discoverable|hard_to_get|missing|contested",
            strength: "strong|moderate|weak|ambiguous|misleading|harmful",
            supportsSide: "plaintiff|defendant|both|neither|unknown",
            evidenceQuality: "string",
            contradiction: "string",
            availableAtStart: "boolean",
          },
        ],
        starterQuestions: {
          plaintiff: ["string"],
          defendant: ["string"],
        },
        theorySeeds: {
          plaintiff: "string",
          defendant: "string",
        },
        settlementLevers: ["string"],
        courtroomOpportunities: ["string"],
        partyProfiles: {
          plaintiff: {
            communicationStyle: "plain|precise|guarded|rambling|combative|measured",
            honesty: "number",
            memoryDiscipline: "number",
            emotionalControl: "number",
            backgroundNotes: ["string"],
          },
          defendant: {
            communicationStyle: "plain|precise|guarded|rambling|combative|measured",
            honesty: "number",
            memoryDiscipline: "number",
            emotionalControl: "number",
            backgroundNotes: ["string"],
          },
        },
      },
    }),
  });

  return normalizeDynamicCaseState({
    aiResult,
    categorySlug: category?.slug || DEFAULT_CATEGORY_SLUG,
    complexity: normalizedComplexity,
    playerLevel: normalizedPlayerLevel,
  });
};
