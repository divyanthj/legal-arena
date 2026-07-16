const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const INTERNAL_DRAFTING_LANGUAGE =
  /\b(?:send one|need exact|still protected|i can authorize|i am not willing|drafting|message history|please respond with concrete terms that fit|counteroffer:)\b/i;

const findMoney = (text) => {
  const match = text.match(
    /(?:discount(?:\s+(?:of|up to|not exceeding))?|up to)\s*((?:₹|rs\.?|inr|\$|£|€)\s*[\d,.]+)/i
  );
  return cleanText(match?.[1]).replace(/[.,]+$/, "");
};

const findDeadline = (text) => {
  const match = text.match(
    /(?:within|firm)\s+(?:a\s+)?((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:business\s+)?(?:day|days|week|weeks|month|months))/i
  );
  return cleanText(match?.[1]);
};

const sentence = (value) => {
  const text = cleanText(value).replace(/[.;:,]+$/, "");
  return text ? `${text}.` : "";
};

const naturalizeTerms = (terms = []) => {
  const rows = (Array.isArray(terms) ? terms : [])
    .map((term) =>
      Array.isArray(term)
        ? { label: cleanText(term[0]), value: cleanText(term[1]) }
        : { label: cleanText(term?.label), value: cleanText(term?.value) }
    )
    .filter(({ label, value }) => label && value);

  if (!rows.length) return "";

  const clauses = rows.map(({ label, value }) => {
    const normalized = label.toLowerCase();
    if (normalized.includes("settlement amount")) return `The proposed financial term is ${value}`;
    if (normalized.includes("corrective work")) return `The proposed corrective work is ${value}`;
    if (normalized.includes("payment timeline")) return `The proposed timing is ${value}`;
    if (normalized.includes("release")) return `The proposed release is ${value}`;
    if (normalized.includes("cost")) return `The proposed treatment of costs is ${value}`;
    if (normalized.includes("fault")) return `The proposed position on fault is ${value}`;
    return `${label} would be ${value}`;
  });

  return `${clauses.map(sentence).join(" ")} Please confirm which of these terms your client can accept.`;
};

export const buildPublicSettlementDraft = ({ clientPreview, terms = [] } = {}) => {
  const aiDraft = cleanText(clientPreview?.outgoingDraft);
  if (aiDraft && !INTERNAL_DRAFTING_LANGUAGE.test(aiDraft)) {
    return aiDraft;
  }

  const guidance = cleanText([
    clientPreview?.authorityReason,
    clientPreview?.suggestedRevision,
    ...(Array.isArray(clientPreview?.drivers) ? clientPreview.drivers : []),
  ].join(" "));

  if (!guidance) return naturalizeTerms(terms);

  const discount = findMoney(guidance);
  const deadline = findDeadline(guidance);
  const completionBased = /completion-based|complete(?:d|\s+the\s+order)|order\s+to\s+be\s+completed/i.test(guidance);
  const noRefund = /no refund|without (?:a )?refund/i.test(guidance);
  const exactBalance = /exact (?:remaining )?balance|revised total price/i.test(guidance);
  const specifications = /clear|confirmed? specifications?|clear specs/i.test(guidance);
  const deliveryPayment = /payment timing tied to (?:delivery|inspection)|payment.*(?:delivery|inspection)/i.test(guidance);
  const delayRemedy = /(?:limited|narrow|capped).*delay remedy|delay remedy.*(?:limited|narrow|capped)/i.test(guidance);
  const noFault = /without admitting fault|no admission of fault/i.test(guidance);

  if (!(completionBased || noRefund || discount || deadline || exactBalance || specifications || delayRemedy)) {
    return naturalizeTerms(terms);
  }

  const paragraphs = [];
  if (completionBased || noRefund) {
    paragraphs.push(
      `My client is prepared to resolve this${completionBased ? " through completion of the order" : ""}${
        noRefund ? ", not a refund" : ""
      }.`
    );
  }

  if (discount || exactBalance) {
    paragraphs.push(
      `We propose${discount ? ` a total discount of ${discount}` : " that the financial terms be revised"}${
        exactBalance
          ? ", with the revised contract price and exact remaining balance stated clearly in the final agreement"
          : ""
      }.`
    );
  }

  if (specifications || deadline) {
    paragraphs.push(
      `We will${specifications ? " confirm the required specifications" : ""}${
        specifications && deadline ? " and" : ""
      }${deadline ? ` commit to delivery within ${deadline}` : ""}.`
    );
  }

  if (deliveryPayment) paragraphs.push("Payment will be tied to delivery or inspection.");
  if (delayRemedy) {
    paragraphs.push(
      `If that deadline is missed, we can agree to a limited, capped delay remedy${
        noFault ? " without any admission of fault" : ""
      }.`
    );
  }

  paragraphs.push("Please confirm whether your client will accept these terms so we can document the final arrangement.");
  return paragraphs.join(" ");
};

export const containsInternalSettlementGuidance = (value) =>
  INTERNAL_DRAFTING_LANGUAGE.test(cleanText(value));
