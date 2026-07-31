import "server-only";

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import {
  requestStructuredCompletion,
  requestWebGroundedStructuredCompletion,
} from "@/libs/gpt";
import { getLawbookRules, getLawbookRulesForCategory } from "@/data/legalArenaLawbook";
import { resolveLawSource } from "./lawSource";

const MODEL =
  process.env.OPENAI_LEGAL_RESEARCH_MODEL?.trim() ||
  process.env.OPENAI_GAMEPLAY_MODEL?.trim() ||
  "gpt-5.4-mini";
const MAX_APPLICABLE_LAWS = 8;
const MAX_SOURCE_BYTES = 4_000_000;

const clean = (value, limit = 12000) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

const stableId = (...parts) =>
  createHash("sha256").update(parts.map(clean).join("|")).digest("hex").slice(0, 20);

const FACT_SHEET_REFERENCE_KEYS = [
  "theory",
  "timeline",
  "supportingFacts",
  "risks",
  "knownClaims",
  "disputedFacts",
  "corroboratedFacts",
  "missingEvidence",
  "desiredRelief",
];

const normalizePointEffect = (value = "") => {
  const effect = clean(value, 40).toLocaleLowerCase();
  if (["supports", "support", "favors", "favourable", "favorable"].includes(effect)) {
    return "supports";
  }
  if (["undermines", "against", "conflicts", "violates", "unfavorable", "unfavourable"].includes(effect)) {
    return "undermines";
  }
  return "context";
};

const normalizeFactSheetReferences = (references = [], factSheet = {}) => {
  const visiblePoints = new Map(
    FACT_SHEET_REFERENCE_KEYS.flatMap((sectionKey) =>
      (factSheet?.[sectionKey] || []).map((pointText) => [
        `${sectionKey}:${clean(pointText, 1200).toLocaleLowerCase()}`,
        { sectionKey, pointText: clean(pointText, 1200) },
      ])
    )
  );

  return [
    ...new Map(
      (Array.isArray(references) ? references : [])
        .map((reference) => {
          const visibleReference = visiblePoints.get(
            `${clean(reference?.sectionKey, 80)}:${clean(
              reference?.pointText,
              1200
            ).toLocaleLowerCase()}`
          );
          return visibleReference
            ? {
                ...visibleReference,
                effect: normalizePointEffect(reference?.effect),
                effectSummary: clean(reference?.effectSummary, 240),
              }
            : null;
        })
        .filter(Boolean)
        .map((reference) => [
          `${reference.sectionKey}:${reference.pointText.toLocaleLowerCase()}`,
          reference,
        ])
    ).values(),
  ].slice(0, 12);
};

export const generateLegalJurisdiction = async ({
  caseCountry,
  template = {},
  userId,
  onUsage,
}) => {
  const base = {
    countryCode: caseCountry?.code || "",
    countryName: caseCountry?.name || "",
    subdivisionCode: "",
    subdivisionName: "",
    locality: "",
  };
  try {
    const result = await requestStructuredCompletion({
      userId,
      model: MODEL,
      maxTokens: 300,
      retryAttempts: 1,
      usageLabel: "applicableLaws.jurisdiction",
      onUsage,
      systemPrompt:
        "Choose one real, existing subdivision and locality within the supplied immutable country for a fictional case. Never invent or disguise a geographic place name. Return valid JSON only.",
      userPrompt: JSON.stringify({
        country: caseCountry,
        case: {
          title: template.title,
          category: template.primaryCategory,
          courtName: template.courtName,
        },
        outputSchema: {
          subdivisionCode: "official code when known, otherwise empty",
          subdivisionName: "real, existing state, province, region, or equivalent",
          locality: "real, existing city or locality",
        },
      }),
    });
    return {
      ...base,
      subdivisionCode: clean(result?.subdivisionCode, 40),
      subdivisionName: clean(result?.subdivisionName, 160),
      locality: clean(result?.locality, 160),
    };
  } catch (error) {
    console.error("Legal jurisdiction generation failed", error);
    return base;
  }
};

const visibleRecord = ({ caseSession, factSheet, transcript }) => ({
  jurisdiction:
    caseSession?.legalJurisdiction ||
    {
      countryCode: caseSession?.caseCountry?.code || "",
      countryName: caseSession?.caseCountry?.name || "",
    },
  category: caseSession?.primaryCategory || caseSession?.templateSnapshot?.primaryCategory || "",
  representedSide: caseSession?.playerSide === "opponent" ? "defendant" : "plaintiff",
  overview: caseSession?.premise?.overview || "",
  openingStatement: caseSession?.premise?.openingStatement || "",
  factSheet: {
    theory: factSheet?.theory || [],
    timeline: factSheet?.timeline || [],
    supportingFacts: factSheet?.supportingFacts || [],
    risks: factSheet?.risks || [],
    knownClaims: factSheet?.knownClaims || [],
    disputedFacts: factSheet?.disputedFacts || [],
    corroboratedFacts: factSheet?.corroboratedFacts || [],
    missingEvidence: factSheet?.missingEvidence || [],
    desiredRelief: factSheet?.desiredRelief || [],
  },
  transcript: (transcript || caseSession?.interviewTranscript || [])
    .slice(-12)
    .map(({ role, speaker, text }) => ({ role, speaker, text: clean(text, 1200) })),
});

const normalizeRulebookLaw = (rule, reason = "", factSheetReferences = []) => ({
  id: `rulebook:${rule.id}`,
  sourceType: "rulebook",
  ruleId: rule.id,
  title: rule.title,
  provisionLabel: rule.title.split(":")[0] || rule.title,
  citation: rule.title.split(":")[0] || rule.title,
  relevanceSummary: clean(reason, 360) || rule.principle,
  displayText: rule.principle,
  principle: rule.principle,
  guidance: rule.guidance,
  tags: rule.tags || [],
  factSheetReferences,
  discoveredAt: new Date().toISOString(),
  status: "applicable",
});

export const selectApplicableRulebookLaws = async ({
  caseSession,
  factSheet = caseSession?.factSheet || {},
  transcript,
  userId,
  onUsage,
}) => {
  const rules = getLawbookRules();
  const valid = new Map(rules.map((rule) => [rule.id, rule]));
  const record = visibleRecord({ caseSession, factSheet, transcript });
  try {
    const result = await requestStructuredCompletion({
      userId,
      model: MODEL,
      maxTokens: 900,
      retryAttempts: 1,
      usageLabel: "applicableLaws.rulebook",
      onUsage,
      systemPrompt:
        "Select the Legal Arena rulebook rules that presently appear applicable from the visible lawyer file only. Never use hidden facts. Return valid JSON only.",
      userPrompt: JSON.stringify({
        task:
          "Choose up to 8 applicable rule IDs, explain each in one short sentence, and link each rule to every exact visible fact-sheet point it affects. For every link, classify whether the rule supports that point, undermines it, or only provides context from the represented player's perspective.",
        visibleRecord: record,
        rules: rules.map(({ id, title, principle, categorySlugs, universal }) => ({
          id,
          title,
          principle,
          categorySlugs,
          universal,
        })),
        outputSchema: {
          applicable: [
            {
              ruleId: "string",
              reason: "string",
              factSheetReferences: [
                {
                  sectionKey: "exact factSheet field name",
                  pointText: "exact visible fact-sheet point text",
                  effect: "supports|undermines|context",
                  effectSummary: "short plain-language explanation",
                },
              ],
            },
          ],
        },
      }),
    });
    const selected = (Array.isArray(result?.applicable) ? result.applicable : [])
      .map((item) => {
        const rule = valid.get(clean(item?.ruleId, 100));
        return rule
          ? normalizeRulebookLaw(
              rule,
              item?.reason,
              normalizeFactSheetReferences(item?.factSheetReferences, record.factSheet)
            )
          : null;
      })
      .filter(Boolean)
      .slice(0, MAX_APPLICABLE_LAWS);
    if (selected.length) return selected;
  } catch (error) {
    console.error("Applicable rulebook selection failed", error);
  }

  return getLawbookRulesForCategory(
    caseSession?.primaryCategory || caseSession?.templateSnapshot?.primaryCategory
  )
    .slice(0, 6)
    .map((rule) => normalizeRulebookLaw(rule));
};

const isPrivateAddress = (address = "") =>
  /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(
    address
  );

const validateSourceUrl = async (value) => {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:") throw new Error("Official law sources must use HTTPS.");
  const records = await lookup(url.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Unsafe law source address.");
  }
  return url;
};

const htmlToText = (html = "") =>
  clean(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"'),
    500_000
  );

const fetchOfficialText = async (sourceUrl) => {
  let current = await validateSourceUrl(sourceUrl);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "LegalArena-LawResearch/1.0" },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      current = await validateSourceUrl(new URL(response.headers.get("location"), current));
      continue;
    }
    if (!response.ok) throw new Error(`Official source returned ${response.status}.`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_SOURCE_BYTES) throw new Error("Official source is too large.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_SOURCE_BYTES) throw new Error("Official source is too large.");
    const type = String(response.headers.get("content-type") || "").toLowerCase();
    if (type.includes("pdf") || current.pathname.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      return clean((await pdfParse(bytes)).text, 500_000);
    }
    if (!type.includes("html") && !type.includes("text")) {
      throw new Error("Unsupported official source format.");
    }
    return htmlToText(bytes.toString("utf8"));
  }
  throw new Error("Too many official source redirects.");
};

const wordingAppearsInSource = (wording, sourceText) => {
  const needle = clean(wording, 12000).toLocaleLowerCase();
  const haystack = clean(sourceText, 500_000).toLocaleLowerCase();
  return needle.length >= 40 && haystack.includes(needle);
};

const normalizeRealLaw = (item, source, factSheet = {}) => ({
  id: `real:${stableId(item.instrumentTitle, item.provisionLabel, item.sourceUrl)}`,
  sourceType: "real",
  title: clean(item.title || `${item.provisionLabel} — ${item.instrumentTitle}`, 300),
  provisionLabel: clean(item.provisionLabel, 160),
  instrumentTitle: clean(item.instrumentTitle, 300),
  citation: clean(item.citation || item.provisionLabel, 240),
  jurisdictionLevel: clean(item.jurisdictionLevel, 80),
  relevanceSummary: clean(item.relevanceSummary, 500),
  displayText: clean(item.relevanceSummary, 500),
  originalLanguage: clean(item.originalLanguage || "Unknown", 80),
  originalText: clean(item.originalText, 12000),
  englishTranslation: clean(item.englishTranslation, 12000),
  sourceUrl: clean(item.sourceUrl, 2000),
  sourceTitle: clean(item.sourceTitle || source?.title, 300),
  sourcePublisher: clean(item.sourcePublisher || source?.publisher, 200),
  effectiveDate: clean(item.effectiveDate, 80),
  factSheetReferences: normalizeFactSheetReferences(
    item.factSheetReferences,
    factSheet
  ),
  retrievedAt: new Date().toISOString(),
  discoveredAt: new Date().toISOString(),
  status: "applicable",
});

export const researchApplicableRealLaws = async ({
  caseSession,
  factSheet = caseSession?.factSheet || {},
  transcript,
  userId,
  onUsage,
}) => {
  const result = await requestWebGroundedStructuredCompletion({
    userId,
    model:
      process.env.OPENAI_LEGAL_RESEARCH_MODEL?.trim() ||
      process.env.OPENAI_CURRENT_EVENTS_MODEL?.trim() ||
      "gpt-5.4",
    maxTokens: 5000,
    retryAttempts: 1,
    usageLabel: "applicableLaws.real",
    onUsage,
    systemPrompt:
      "Research currently binding legislation, constitutional provisions, codes, and regulations for the supplied jurisdiction and visible case record. Exclude cases, commentary, and guidance. Use official primary sources and reproduce provision wording exactly. Return valid JSON only.",
    userPrompt: JSON.stringify({
      task: "Find up to 8 provisions that presently appear applicable.",
      visibleRecord: visibleRecord({ caseSession, factSheet, transcript }),
      requirements: [
        "Use only visible facts.",
        "Every item must link directly to an official government or legislature source.",
        "originalText must be a verbatim provision or relevant subsection, not a paraphrase.",
        "Provide an English translation when originalText is not English.",
        "Link each provision to every exact visible fact-sheet point it affects using factSheetReferences.",
        "For every link, classify whether the provision supports that point, undermines it, or only provides context from the represented player's perspective.",
      ],
      outputSchema: {
        applicable: [
          {
            title: "string",
            instrumentTitle: "string",
            provisionLabel: "string",
            citation: "string",
            jurisdictionLevel: "national|subnational|local",
            relevanceSummary: "one sentence",
            factSheetReferences: [
              {
                sectionKey: "exact factSheet field name",
                pointText: "exact visible fact-sheet point text",
                effect: "supports|undermines|context",
                effectSummary: "short plain-language explanation",
              },
            ],
            originalLanguage: "string",
            originalText: "verbatim string",
            englishTranslation: "string",
            sourceUrl: "official https URL",
            sourceTitle: "string",
            sourcePublisher: "string",
            effectiveDate: "string or empty",
          },
        ],
      },
    }),
  });

  const candidates = Array.isArray(result.payload?.applicable)
    ? result.payload.applicable.slice(0, MAX_APPLICABLE_LAWS)
    : [];
  const verified = (
    await Promise.all(
      candidates.map(async (item) => {
        try {
          const sourceText = await fetchOfficialText(item?.sourceUrl);
          if (!wordingAppearsInSource(item?.originalText, sourceText)) return null;
          const citedSource = result.sources.find((source) => source.url === item.sourceUrl);
          return normalizeRealLaw(item, citedSource, factSheet);
        } catch (error) {
          console.warn("Real-law source could not be verified", {
            sourceUrl: item?.sourceUrl,
            message: error.message,
          });
          return null;
        }
      })
    )
  ).filter(Boolean);
  return [...new Map(verified.map((law) => [law.id, law])).values()].slice(
    0,
    MAX_APPLICABLE_LAWS
  );
};

export const refreshApplicableLaws = async (options) => {
  const lawSource = resolveLawSource(options?.caseSession?.lawSource);
  const previous = Array.isArray(options?.caseSession?.applicableLaws)
    ? options.caseSession.applicableLaws
    : [];
  try {
    const laws =
      lawSource === "real"
        ? await researchApplicableRealLaws(options)
        : await selectApplicableRulebookLaws(options);
    if (!laws.length) {
      return {
        laws: previous,
        status: "unavailable",
        warning:
          lawSource === "real"
            ? "No verified official provisions are currently available for this case."
            : "Applicable rule suggestions are temporarily unavailable.",
      };
    }
    return { laws, status: "ready", warning: "" };
  } catch (error) {
    console.error("Applicable-law refresh failed", error);
    return {
      laws: previous,
      status: previous.length ? "stale" : "unavailable",
      warning:
        lawSource === "real"
          ? "Official-law research could not be refreshed. Check the linked sources before relying on this material."
          : "Applicable rule suggestions could not be refreshed.",
    };
  }
};

export const mergeApplicableLaws = (...groups) =>
  [
    ...new Map(
      groups
        .flat()
        .filter(Boolean)
        .map((law) => [String(law.id || stableId(law.title, law.citation)), law])
    ).values(),
  ].slice(0, MAX_APPLICABLE_LAWS);
