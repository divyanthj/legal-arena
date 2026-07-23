import "server-only";

import {
  requestStructuredCompletion,
  requestWebGroundedStructuredCompletion,
} from "@/libs/gpt";
import { buildCaseCountry } from "./countries";
import { getCategoryBySlug } from "./categories";
import {
  buildPublicCurrentEventInspiration,
  cleanCurrentEventText,
  collectCurrentEventProtectedTerms,
  findCurrentEventLeaks,
  hasPlayableCurrentEventCaseShape,
  normalizeCurrentEventSources,
  rankCurrentEventCandidates,
} from "./currentEventsCore.mjs";

export const CURRENT_EVENTS_CATEGORY_SLUG = "current-events";
export {
  applyCurrentEventAnonymizationRepair,
  buildPublicCurrentEventInspiration,
  findCurrentEventLeaks,
  hasPlayableCurrentEventCaseShape,
  normalizeCurrentEventSources,
} from "./currentEventsCore.mjs";

const CURRENT_EVENTS_MODEL =
  process.env.OPENAI_CURRENT_EVENTS_MODEL?.trim() || "gpt-5.4";

const cleanText = cleanCurrentEventText;

const validUnderlyingCategory = (value = "") => {
  const slug = cleanText(value, 80);
  const category = getCategoryBySlug(slug);
  return category && slug !== CURRENT_EVENTS_CATEGORY_SLUG
    ? slug
    : "administrative";
};

const normalizeSensitiveFlags = (flags = {}) => ({
  centralMinor: Boolean(flags.centralMinor),
  graphicOrSexualViolence: Boolean(flags.graphicOrSexualViolence),
  activeWarIncident: Boolean(flags.activeWarIncident),
  massCasualtyEvent: Boolean(flags.massCasualtyEvent),
  veryRecentDeath: Boolean(flags.veryRecentDeath),
});

const isEligibleBrief = (brief = {}) => {
  const flags = normalizeSensitiveFlags(brief.sensitiveFlags);
  return (
    cleanText(brief.eventSummary, 4000).length >= 80 &&
    !Object.values(flags).some(Boolean)
  );
};

const mergeResearchResult = ({ payload = {}, citedSources = [], country, window }) => {
  const sources = normalizeCurrentEventSources(payload.sources, citedSources);
  return {
    country,
    searchScope: window.scope,
    freshnessDays: window.days,
    retrievedAt: new Date().toISOString(),
    eventDate: cleanText(payload.eventDate, 80),
    eventSummary: cleanText(payload.eventSummary, 4000),
    legalHooks: (Array.isArray(payload.legalHooks) ? payload.legalHooks : [])
      .map((item) => cleanText(item, 300))
      .filter(Boolean)
      .slice(0, 8),
    underlyingCategorySlug: validUnderlyingCategory(
      payload.underlyingCategorySlug
    ),
    reportedUncertainties: (
      Array.isArray(payload.reportedUncertainties)
        ? payload.reportedUncertainties
        : []
    )
      .map((item) => cleanText(item, 500))
      .filter(Boolean)
      .slice(0, 8),
    namedEntities: (Array.isArray(payload.namedEntities)
      ? payload.namedEntities
      : []
    )
      .map((item) => cleanText(item, 200))
      .filter(Boolean)
      .slice(0, 40),
    identifyingDetails: (
      Array.isArray(payload.identifyingDetails)
        ? payload.identifyingDetails
        : []
    )
      .map((item) => cleanText(item, 300))
      .filter(Boolean)
      .slice(0, 40),
    sensitiveFlags: normalizeSensitiveFlags(payload.sensitiveFlags),
    sources,
  };
};

const researchWindows = [
  { days: 14, scope: "country" },
  { days: 30, scope: "country" },
  { days: 30, scope: "regional-impact" },
];

const discoverHotButtonCandidates = async ({
  country,
  window,
  startDate,
  endDate,
  scopeInstruction,
  userId,
  onUsage,
  now,
}) => {
  const result = await requestWebGroundedStructuredCompletion({
    userId,
    model: CURRENT_EVENTS_MODEL,
    maxTokens: 4000,
    usageLabel: `currentEvents.discover.${window.scope}.${window.days}`,
    onUsage,
    serviceTier: "priority",
    retryAttempts: 1,
    systemPrompt:
      "Search broadly for the hottest current legal and civic issues in the selected jurisdiction. Compare multiple eligible stories before returning a JSON shortlist. Optimize for what people would presently recognize as a headline issue, not for whichever event is easiest to fictionalize.",
    userPrompt: JSON.stringify({
      task:
        "Find and compare exactly 5 eligible recent events. Keep each summary under 80 words and return the strongest hot-button candidates; do not select a routine minor story merely because it has an official press release.",
      country,
      dateRange: { startDate, endDate },
      scopeInstruction,
      rankingRules: [
        "Prioritize events with intense current or still-growing coverage, broad public attention, active political or civic debate, consequential official responses, and substantial legal stakes.",
        "Prefer an ongoing event or one covered in the last 72 hours over an older event unless the older event is clearly more nationally consequential.",
        "Nationwide constitutional, governmental, political, civil-liberties, major corporate, or mass public-interest controversies should outrank routine enforcement notices, small penalties, isolated glitches, and ordinary individual disputes.",
        "Source credibility is an eligibility threshold, not a proxy for public importance. An official release alone does not make an event hot-button.",
        "Every candidate needs at least two independent credible reports, or one authoritative primary source plus reliable independent reporting.",
        "Exclude minors as central parties, graphic or sexual violence, active-war incidents, mass-casualty events, and very recent deaths.",
        "Scores must compare candidates within this search, where 5 means exceptional current prominence and 1 means limited prominence.",
      ],
      outputSchema: {
        candidates: [
          {
            key: "short stable descriptor",
            headline: "string",
            summary: "string",
            eventDate: "YYYY-MM-DD",
            ongoing: "boolean",
            geographicReach: "national|regional|local",
            publicAttention: "integer 1-5",
            recentMomentum: "integer 1-5",
            legalSignificance: "integer 1-5",
            publicControversy: "integer 1-5",
            routineRegulatoryAction: "boolean",
            sources: [
              {
                title: "string",
                publisher: "string",
                url: "https URL",
                publishedAt: "string",
              },
            ],
          },
        ],
      },
    }),
  });

  return rankCurrentEventCandidates(result.payload?.candidates, { now });
};

const buildDetailedEventBrief = async ({
  candidate,
  country,
  window,
  startDate,
  endDate,
  scopeInstruction,
  userId,
  onUsage,
}) => {
  const result = await requestWebGroundedStructuredCompletion({
    userId,
    model: CURRENT_EVENTS_MODEL,
    maxTokens: 2200,
    usageLabel: `currentEvents.research.${window.scope}.${window.days}`,
    onUsage,
    serviceTier: "priority",
    retryAttempts: 1,
    systemPrompt:
      "Research the specifically selected hot-button event for a fictional legal-strategy case. Search the web, distinguish reported allegations from established facts, and return valid JSON only. Do not substitute a different, easier story.",
    userPrompt: JSON.stringify({
      task:
        "Prepare a source-grounded inspiration brief for this selected event.",
      selectedCandidate: candidate,
      country,
      dateRange: { startDate, endDate },
      scopeInstruction,
      selectionRules: [
        "Stay focused on the selected event and its central live legal controversy.",
        "Require two independent credible reports, or an authoritative primary source plus reliable reporting.",
        "The event must support a balanced two-sided legal dispute involving an individual, company, official, politician, agency, or government.",
        "Do not decide whether reported allegations are true.",
        "Extract every real person, organization, office title, exact place, quotation, date, amount, acronym, and distinctive phrase that must not appear in the fictional case.",
      ],
      outputSchema: {
        eventDate: "string",
        eventSummary: "string",
        legalHooks: ["string"],
        underlyingCategorySlug:
          "rental-dispute|marital-dispute|business-dispute|contract-violation|employment|property|personal-injury|consumer|criminal|administrative",
        reportedUncertainties: ["string"],
        namedEntities: ["string"],
        identifyingDetails: ["string"],
        sensitiveFlags: {
          centralMinor: "boolean",
          graphicOrSexualViolence: "boolean",
          activeWarIncident: "boolean",
          massCasualtyEvent: "boolean",
          veryRecentDeath: "boolean",
        },
        sources: [
          {
            title: "string",
            publisher: "string",
            url: "https URL",
            publishedAt: "string",
          },
        ],
      },
    }),
  });

  return mergeResearchResult({
    payload: result.payload,
    citedSources: result.sources,
    country,
    window,
  });
};

export const researchCurrentEvent = async ({
  countryCode,
  userId = "system",
  onUsage,
  now = new Date(),
} = {}) => {
  const country = buildCaseCountry(countryCode, { fallback: true });

  for (const window of researchWindows) {
    const startDate = new Date(
      now.getTime() - window.days * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);
    const scopeInstruction =
      window.scope === "country"
        ? `The event must have occurred in or directly concern ${country.name}.`
        : `If local reporting is sparse, use a regional or international event with a concrete legal, governmental, commercial, or civic impact on ${country.name}.`;

    try {
      const candidates = await discoverHotButtonCandidates({
        country,
        window,
        startDate,
        endDate,
        scopeInstruction,
        userId,
        onUsage,
        now,
      });

      for (const candidate of candidates.slice(0, 3)) {
        const brief = await buildDetailedEventBrief({
          candidate,
          country,
          window,
          startDate,
          endDate,
          scopeInstruction,
          userId,
          onUsage,
        });
        if (isEligibleBrief(brief) && brief.sources.length >= 2) return brief;
      }
    } catch (error) {
      if (error?.code === "current_event_search_unavailable") throw error;
      console.warn("Current-event research attempt failed.", {
        country: country.code,
        scope: window.scope,
        days: window.days,
        error: error?.message || String(error),
      });
    }
  }

  const error = new Error(
    `No suitable recent event could be verified for ${country.name}. Please try Headlines again.`
  );
  error.status = 503;
  error.code = "current_event_search_unavailable";
  throw error;
};

export const repairCurrentEventAnonymization = async ({
  generatedCase,
  brief,
  leaks,
  userId,
  onUsage,
} = {}) =>
  requestStructuredCompletion({
    userId,
    model: CURRENT_EVENTS_MODEL,
    temperature: 0.2,
    maxTokens: 3200,
    retryAttempts: 1,
    throwOnError: true,
    usageLabel: "currentEvents.anonymizationRepair",
    onUsage,
    systemPrompt:
      "You anonymize a fictional legal-strategy case. Return the complete corrected case as the top-level JSON object only: do not wrap it in correctedCase, repairedCase, generatedCase, case, result, or data. Preserve every existing key, array entry, legal controversy, balance, complexity, and evidence link.",
    userPrompt: JSON.stringify({
      task:
        "Replace every protected real-world identifier with invented country-plausible details. Do not mention, mask, initial, paraphrase closely, or hint at the protected terms.",
      protectedTerms: collectCurrentEventProtectedTerms(brief),
      detectedLeaks: leaks,
      generatedCase,
    }),
  });
