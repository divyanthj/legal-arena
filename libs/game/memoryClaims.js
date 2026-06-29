const CLAIM_LIMIT = 8;

const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const slugifyTopic = (value = "") =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const inferTopicKey = (text = "") => {
  const lower = normalizeText(text).toLowerCase();
  const domains = [
    ["deposit", /\bdeposit|withheld|deduct|refund|cleaning|repair|ordinary wear|damage\b/],
    ["amount", /\$[\d,]+|\b\d{2,6}\s+dollars?\b|\bamount|cost|charge|paid|owed\b/],
    ["possession", /\bstole|took|kept|returned|possess|owned|belong|held\b/],
    ["timing", /\bwhen|before|after|date|day|week|month|late|timely|notice\b/],
    ["condition", /\bcondition|broken|clean|dirty|damaged|working|defect|repair\b/],
    ["consent", /\bagreed|approved|permission|consent|authorized|allowed\b/],
    ["causation", /\bbecause|caused|responsible|fault|due to|led to\b/],
  ];
  const matched = domains.find(([, pattern]) => pattern.test(lower));

  return matched?.[0] || slugifyTopic(lower.split(/\s+/).slice(0, 5).join(" "));
};

const normalizeSide = (side = "client") =>
  ["opponent", "defendant"].includes(String(side || "").toLowerCase())
    ? "opponent"
    : "client";

export const normalizeMemoryClaims = (claims = [], side = "client") => {
  const normalizedSide = normalizeSide(side);
  const seen = new Set();

  return (Array.isArray(claims) ? claims : [])
    .map((claim) => {
      const text = normalizeText(claim?.text || claim?.claim || claim?.claimedDetail);
      const topicKey = slugifyTopic(claim?.topicKey) || inferTopicKey(text);

      return {
        text,
        topicKey,
        side: normalizeSide(claim?.side || normalizedSide),
        stance: normalizeText(claim?.stance || "claims").toLowerCase().slice(0, 32),
      };
    })
    .filter((claim) => claim.text && claim.topicKey)
    .filter((claim) => {
      const key = `${claim.side}:${claim.topicKey}:${claim.text.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, CLAIM_LIMIT);
};

export const mergeMemoryClaims = (existingClaims = [], newClaims = [], side = "client") =>
  normalizeMemoryClaims([...normalizeMemoryClaims(existingClaims, side), ...newClaims], side);

const negativePattern =
  /\b(no|not|never|didn'?t|doesn'?t|wasn'?t|weren'?t|without|false|deny|denies|denied|dispute|disputes|wrong|instead|only|less|more)\b/i;
const materialPattern =
  /\b(amount|condition|possession|payment|timing|causation|consent|deposit|deduct|withheld|stole|took|paid|owed|damage|repair|notice|agreed)\b/i;
const moneyPattern = /\$[\d,]+(?:\.\d{2})?|\b\d{2,6}\s+dollars?\b/gi;

const moneyValues = (text = "") =>
  normalizeText(text)
    .match(moneyPattern)
    ?.map((item) => item.toLowerCase()) || [];

const claimsContradict = (left, right) => {
  if (!left?.text || !right?.text || left.topicKey !== right.topicKey) {
    return false;
  }

  const leftMoney = moneyValues(left.text);
  const rightMoney = moneyValues(right.text);
  if (
    leftMoney.length &&
    rightMoney.length &&
    leftMoney.some((value) => !rightMoney.includes(value))
  ) {
    return true;
  }

  const combined = `${left.text} ${right.text}`;
  return negativePattern.test(combined) || materialPattern.test(combined);
};

export const buildMemoryClaimFactSheetPatch = ({
  ownClaims = [],
  opposingClaims = [],
  side = "client",
} = {}) => {
  const own = normalizeMemoryClaims(ownClaims, side);
  const other = normalizeMemoryClaims(opposingClaims, normalizeSide(side) === "client" ? "opponent" : "client");
  const disputedFacts = [];
  const knownClaims = [];

  own.forEach((claim) => {
    const opposing = other.find((candidate) => claimsContradict(claim, candidate));
    if (opposing) {
      disputedFacts.push(`Whether ${claim.text}`);
      return;
    }
    knownClaims.push(claim.text);
  });

  return {
    knownClaims,
    disputedFacts,
  };
};
