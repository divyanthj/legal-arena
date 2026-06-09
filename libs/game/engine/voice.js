const escapeRegExp = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const uniqueList = (items = []) =>
  [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const capitalizeFirst = (value = "") =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "";

const lowerFirst = (value = "") =>
  value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : "";

const getPartyAliases = ({ partyName = "", playerSide = "client" } = {}) => {
  const name = String(partyName || "").trim();
  const nameWithoutEntitySuffix = name
    .replace(/,\s*(?:llc|l\.l\.c\.|inc\.?|corp\.?|corporation|ltd\.?)$/i, "")
    .trim();
  const firstName = name.split(/\s+/)[0] || "";
  const sideAliases =
    playerSide === "opponent"
      ? ["the defendant", "defendant", "the opponent", "opponent"]
      : ["the plaintiff", "plaintiff", "the client", "client", "the tenant", "tenant"];

  return uniqueList([
    name,
    nameWithoutEntitySuffix,
    firstName.length > 2 ? firstName : "",
    ...sideAliases,
  ]).sort((left, right) => right.length - left.length);
};

const SELF_SUBJECT_VERBS = {
  am: "am",
  are: "am",
  asked: "asked",
  believes: "believe",
  believed: "believed",
  called: "called",
  can: "can",
  cannot: "cannot",
  complained: "complained",
  did: "did",
  does: "do",
  emailed: "emailed",
  found: "found",
  gave: "gave",
  had: "had",
  has: "have",
  is: "am",
  kept: "kept",
  knows: "know",
  learned: "learned",
  moved: "moved",
  noticed: "noticed",
  objected: "objected",
  paid: "paid",
  provided: "provided",
  received: "received",
  remembers: "remember",
  remembered: "remembered",
  requested: "requested",
  returned: "returned",
  said: "said",
  saved: "saved",
  saw: "saw",
  sent: "sent",
  showed: "showed",
  signed: "signed",
  texted: "texted",
  thinks: "think",
  thought: "thought",
  told: "told",
  wants: "want",
  was: "was",
  went: "went",
};

const SELF_SUBJECT_VERB_PATTERN = Object.keys(SELF_SUBJECT_VERBS)
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join("|");

const REPORTING_VERBS =
  "says|said|states|stated|explains|explained|believes|believed|remembers|remembered|thinks|thought|claims|claimed";

const makeAliasPattern = (aliases = []) =>
  aliases.map(escapeRegExp).join("|");

const normalizeCapitalization = (before = "", replacement = "") =>
  !before || /(?:^|[.!?]\s+)$/.test(before) ? capitalizeFirst(replacement) : replacement;

export const normalizePartySpeechToFirstPerson = ({
  text = "",
  partyName = "",
  playerSide = "client",
} = {}) => {
  const aliases = getPartyAliases({ partyName, playerSide });
  if (!aliases.length) {
    return String(text || "").trim();
  }

  const aliasPattern = makeAliasPattern(aliases);
  const selfPronounPattern = `she|he|they|it|${aliasPattern}`;
  let normalized = String(text || "").trim();

  if (!normalized) {
    return "";
  }

  normalized = normalized.replace(
    new RegExp(`\\b(${aliasPattern})'s\\b`, "gi"),
    "my"
  );

  normalized = normalized.replace(
    new RegExp(
      `(^|[.!?]\\s+|\\bthat\\s+|\\band\\s+|\\bbut\\s+)(${aliasPattern})\\s+(?:${REPORTING_VERBS})\\s+(?:that\\s+)?(?:${selfPronounPattern})\\s+`,
      "gi"
    ),
    (match, before) => `${before}${normalizeCapitalization(before, "I")} `
  );

  normalized = normalized.replace(
    new RegExp(
      `(^|[.!?]\\s+|\\bthat\\s+|\\band\\s+|\\bbut\\s+)(${aliasPattern})\\s+(${SELF_SUBJECT_VERB_PATTERN})\\b`,
      "gi"
    ),
    (match, before, alias, verb) => {
      const replacementVerb = SELF_SUBJECT_VERBS[String(verb || "").toLowerCase()] || verb;
      return `${before}${normalizeCapitalization(before, `I ${replacementVerb}`)}`;
    }
  );

  normalized = normalized
    .replace(/^my\b/, "My")
    .replace(/\bI says\b/gi, "I say")
    .replace(/\bI believes\b/gi, "I believe")
    .replace(/\bI remembers\b/gi, "I remember")
    .replace(/\bI thinks\b/gi, "I think")
    .replace(/\bI wants\b/gi, "I want")
    .replace(/\bI knows\b/gi, "I know")
    .replace(/\bI does\b/gi, "I do")
    .replace(/\bI has\b/gi, "I have")
    .replace(/\bI is\b/gi, "I am")
    .replace(/\bI are\b/gi, "I am")
    .replace(/\bthat I ([A-Z])/g, (match, letter) => `that I ${letter.toLowerCase()}`)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  return normalized;
};

export const hasThirdPersonSelfReference = ({
  text = "",
  partyName = "",
  playerSide = "client",
} = {}) => {
  const aliases = getPartyAliases({ partyName, playerSide });
  if (!aliases.length) {
    return false;
  }

  const aliasPattern = makeAliasPattern(aliases);
  const selfReferencePattern = new RegExp(
    `\\b(${aliasPattern})\\s+(?:${REPORTING_VERBS}|${SELF_SUBJECT_VERB_PATTERN})\\b`,
    "i"
  );

  return selfReferencePattern.test(String(text || ""));
};
